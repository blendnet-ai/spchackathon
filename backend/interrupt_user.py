# This agent keeps track of the number of sentences the user has spoken
# and interrupts them if they've said a certain number of sentences.
# We use session.say() to interrupt the user, and set allow_interruptions=False
# on that specific call to prevent the user from interrupting the agent.
# After the agent has spoken, allow_interruptions is once again True so the agent
# can listen for the user's response.

import logging
from pathlib import Path
from dotenv import load_dotenv
from livekit.agents import JobContext, WorkerOptions, cli
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import openai,  silero, elevenlabs, google,deepgram
from openai.types.beta.realtime.session import InputAudioNoiseReduction, TurnDetection
from livekit.agents.llm import ChatContext, ChatMessage
import re
from livekit.agents import UserInputTranscribedEvent, ConversationItemAddedEvent

import asyncio
from livekit.agents.llm import llm
load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')

logger = logging.getLogger("interrupt-user")
logger.setLevel(logging.INFO)

def count_sentences(text):
    """Count the number of sentences in text"""
    sentences = re.findall(r'[^.!?]+[.!?](?:\s|$)', text)
    return len(sentences)

async def entrypoint(ctx: JobContext):
    await ctx.connect()
    
    session = AgentSession()
    agent = Agent(
        # instructions="You are an agent which recieves audio from multiple users and just listens and generate transcript.\
        #       Speak in a human like manner with filler words and pauses. \
        #       You only speak when the system msg asks you to speak and then you again stay quite till another msg comes.",
        instructions="You are an agent who is getting transcripts of users as they speak between each other. \
        Every time you see a user speaking you should first think whether you should interrupt them or not.\
        You will get engagement stats every few seconds.You should interrupt if you get a message if engagement is below 10%\
        If you want to speak, you should write __speak__ before your message. \
        Your job is to listen to users while they are talking to each other and speak when you are asked to speak.",
        # stt=elevenlabs.STT(api_key="sk_f3d9665f3c1426cf2e7bb96bfc348115e3a91b7705ff8720",
        #                    base_url="https://api.elevenlabs.io/v1",                           
        #                    language_code="en"),
        # stt=google.STT(),
        # stt=deepgram.STT(api_key="678e6b29aee68a856c38ca23d277df2222f7e358"),
        # tools=[llm.FunctionTool(name="speak", description="Speak a message to the user", parameters=llm.FunctionToolParameter(name="message", type="string"))],

        # stt=openai.STT(),
        # llm=openai.LLM(),
        # tts=openai.TTS(),   
        # vad=silero.VAD.load()
        llm=openai.realtime.RealtimeModel(
            voice="coral",
            input_audio_noise_reduction=InputAudioNoiseReduction(type="near_field"),
            turn_detection=TurnDetection(
                        type="server_vad", 
                        threshold=1, 
                #                          eagerness="low",
                #                          interrupt_response=False,
                #                         #  prefix_padding_ms=300, 
                        silence_duration_ms=10000, 
                        create_response=True)
            # turn_detection=None,
        )
    )
    
    async def handle_interruption(context):
        await agent.update_chat_ctx(context)
        # agent.llm.mes
        session.say("Sorry, can I pause you there?", allow_interruptions=False)
        await session.generate_reply(allow_interruptions=False)
    
    users = ["Alice", "Bob", "Charlie"]
    current_user_idx = 0
    transcript_buffer = ""
    max_sentences = 3
    max_chars = 50

    # async def on_user_turn_completed(chat_ctx, new_message:ChatMessage):  
    #     print(f"User turn completed: {new_message}")
    #     return new_message
    
    # agent.on_user_turn_completed = on_user_turn_completed
    @session.on("conversation_item_added")
    def on_conversation_item_added(event: ConversationItemAddedEvent):
        print(f"Conversation item added from {event.item.role}: {event.item.text_content}. interrupted: {event.item.interrupted}")
        # to iterate over all types of content:
        for content in event.item.content:
            if isinstance(content, str):
                print(f" - text: {content}")


    # @session.on("user_input_transcribed")
    @session.on("input_audio_transcription_completed")
    def on_user_input_transcribed(transcriptEvent:UserInputTranscribedEvent):
        nonlocal transcript_buffer, current_user_idx        
        transcript_buffer += " " + transcriptEvent.transcript
        transcript_buffer = transcript_buffer.strip()
        print(f"[User: {users[current_user_idx]}] Buffer: {transcript_buffer}. Length: {len(transcript_buffer)}")
        # if "over" in transcript_buffer.lower():
        #     async def just_reply():
        #         await session.generate_reply()
        #     asyncio.create_task(just_reply())
        #     return 
        if len(transcript_buffer) > max_chars:
            # Cycle to next user
            current_user_idx = (current_user_idx + 1) % len(users)
            transcript_buffer = ""
            # Prompt LLM to announce next user (as user input)
            next_user = users[current_user_idx]
            prompt = f"Don't answer the last query. Interrupt the user {next_user} by saying their name 3 times. Like this: '{next_user} {next_user} {next_user} {next_user}, please listen to me.'"
            print(f"Cycling to next user: {next_user}")
            # session.generate_reply(user_input=prompt)
            # --- If you want to use a system message instead, use the following code: ---
            from livekit.agents.llm import ChatContext, ChatMessage
            chat_ctx = session.history  # or agent.chat_ctx if available
            chat_ctx.insert(ChatMessage(role="system", content=[prompt]))
            async def update_ctx_and_reply():
                await agent.update_chat_ctx(chat_ctx)
                await session.generate_reply()
            asyncio.create_task(update_ctx_and_reply())
    
    # @session.on("user_input_transcribed")
    def on_transcript(transcript):
        nonlocal transcript_buffer
        
        print(f"Transcript event: {transcript}")
        if transcript.is_final:
            print(f"Received final transcript: {transcript.transcript}")
            print(f"Final transcript received: {transcript.transcript}")
            return
            
        transcript_buffer += " " + transcript.transcript
        transcript_buffer = transcript_buffer.strip()
        
        print(f"Buffer: {transcript_buffer}")
        print(f"Current conversation buffer: {transcript_buffer}")
        
        sentence_count = count_sentences(transcript_buffer)
        print(f"Sentence count: {sentence_count}")
        
        if sentence_count >= max_sentences:
            print("Interrupting user...")
            print(f"Interrupting with buffer: {transcript_buffer}")
            
            interruption_ctx = ChatContext([
                ChatMessage(
                    type="message",
                    role="system",
                    content=["You are an agent that politely interrupts users who speak too much. Create a brief response that acknowledges what they've said so far, then redirects to get more focused information."]
                ),
                ChatMessage(type="message", role="user", content=[f"User has been speaking and said: {transcript_buffer}"])
            ])
            
            asyncio.create_task(handle_interruption(interruption_ctx))
            transcript_buffer = ""
        

    @session.on("session_start")
    def on_session_start():
        nonlocal transcript_buffer
        transcript_buffer = ""
        print("Session started. Conversation buffer reset.")
        next_user = users[current_user_idx]
        prompt = f"Now {next_user} will speak."
        session.generate_reply()
        from livekit.agents.llm import ChatContext, ChatMessage
        chat_ctx = session.history  # or agent.chat_ctx if available
        chat_ctx.insert(ChatMessage(role="system", content=[prompt]))
        async def update_ctx_and_reply():
            await agent.update_chat_ctx(chat_ctx)
            await session.generate_reply()
        asyncio.create_task(update_ctx_and_reply())
    
    # Add logging for agent utterances
    orig_say = session.say
    def logged_say(*args, **kwargs):
        print(f"Agent says: {args[0] if args else ''}")
        return orig_say(*args, **kwargs)
    session.say = logged_say

    orig_generate_reply = session.generate_reply
    def logged_generate_reply(*args, **kwargs):
        print("Agent is generating a reply.")
        return orig_generate_reply(*args, **kwargs)
    session.generate_reply = logged_generate_reply
    session._on_text_output_changed

    # State tracking
    agent_state = "listening"  # default, update as events come in
    user_state = "listening"   # default, update as events come in

    # @session.on("agent_state_changed")
    def on_agent_state_changed(event):
        nonlocal agent_state
        agent_state = getattr(event, "new_state", "listening")
        print(f"[Agent state changed] {event.old_state} -> {event.new_state}")

    # @session.on("user_state_changed")
    def on_user_state_changed(event):
        nonlocal user_state
        old_state = getattr(event, "old_state", "listening")
        new_state = getattr(event, "new_state", "listening")
        user_state = new_state
        print(f"[User state changed] {old_state} -> {new_state}")
        if old_state == "listening" and new_state == "speaking" and agent_state == "speaking":
            # Interrupt logic: do not process transcript, instead prompt LLM
            prompt = "First tell this current user to please hold a minute. Because he was speaking in between, complete your earlier thought and then reply."
            from livekit.agents.llm import ChatContext, ChatMessage
            chat_ctx = session.history
            chat_ctx.insert(ChatMessage(role="system", content=[prompt]))
            async def update_ctx_and_reply():
                await agent.update_chat_ctx(chat_ctx)
                await session.generate_reply()
            asyncio.create_task(update_ctx_and_reply())

    await session.start(agent=agent, room=ctx.room)
print("Interrupt user agent started. Name is {__name__}")
if __name__ == "__main__":
    print("Starting interrupt user agent...")
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint,agent_name="interrupt_user"))