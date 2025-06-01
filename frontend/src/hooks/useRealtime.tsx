import useWebSocket from "react-use-websocket";

export interface Participant {
  id: number;
  name: string;
  avatar: string;
  isMuted: boolean;
  isActive: boolean;
}

import {
  InputAudioBufferAppendCommand,
  InputAudioBufferClearCommand,
  Message,
  ResponseAudioDelta,
  ResponseAudioTranscriptDelta,
  ResponseDone,
  SessionUpdateCommand,
  ExtensionMiddleTierToolResponse,
  ResponseInputAudioTranscriptionCompleted,
} from "../pages/Realtime/types";
import { auth } from "../configs/firebase";

type Parameters = {
  url: string;
  useDirectAoaiApi?: boolean; // If true, the middle tier will be skipped and the AOAI ws API will be called directly
  aoaiEndpointOverride?: string;
  aoaiApiKeyOverride?: string;
  aoaiModelOverride?: string;

  enableInputAudioTranscription?: boolean;
  onWebSocketOpen?: () => void;
  onWebSocketClose?: () => void;
  onWebSocketError?: (event: Event) => void;
  onWebSocketMessage?: (event: MessageEvent<any>) => void;

  onReceivedResponseAudioDelta?: (message: ResponseAudioDelta) => void;
  onReceivedInputAudioBufferSpeechStarted?: (message: Message) => void;
  onReceivedResponseDone?: (message: ResponseDone) => void;
  onReceivedExtensionMiddleTierToolResponse?: (
    message: ExtensionMiddleTierToolResponse
  ) => void;
  onReceivedResponseAudioTranscriptDelta?: (
    message: ResponseAudioTranscriptDelta
  ) => void;
  onReceivedInputAudioTranscriptionCompleted?: (
    message: ResponseInputAudioTranscriptionCompleted
  ) => void;
  onReceivedError?: (message: Message) => void;
  onScoreUpdated?: (score: number) => void;
  skipToken?: boolean;
  onQuestionTransition?: (message: Message) => void;
  onUserJoined?: (participant: Participant) => void;
  onParticipantsList?: (participants: Participant[]) => void;
  onParticipantMessage?: (message: Message, userId: string) => void;
  setMyUserId?: (userId: string) => void;
};

export default function useRealTime({
  useDirectAoaiApi,
  aoaiEndpointOverride,
  aoaiApiKeyOverride,
  aoaiModelOverride,
  enableInputAudioTranscription,
  onWebSocketOpen,
  onWebSocketClose,
  onWebSocketError,
  onWebSocketMessage,
  onReceivedResponseDone,
  onReceivedResponseAudioDelta,
  onReceivedResponseAudioTranscriptDelta,
  onReceivedInputAudioBufferSpeechStarted,
  onReceivedExtensionMiddleTierToolResponse,
  onReceivedInputAudioTranscriptionCompleted,
  onReceivedError,
  onScoreUpdated,
  onQuestionTransition,
  url,
  skipToken,
  onUserJoined,
  onParticipantsList,
  onParticipantMessage,
  setMyUserId,
}: Parameters) {
  const wsEndpoint = url;
  const { sendJsonMessage: _sendJsonMessage } = useWebSocket(wsEndpoint, {
    onOpen: () => onWebSocketOpen?.(),
    onClose: () => onWebSocketClose?.(),
    onError: (event) => onWebSocketError?.(event),
    onMessage: (event) => onMessageReceived(event),
    shouldReconnect: () => true,
  });

  const sendJsonMessage = async (message: any) => {
    if (!skipToken) {
      message.token = await auth.currentUser?.getIdToken();
    }

    _sendJsonMessage(message);
  };

  const startSession = () => {
    const command: SessionUpdateCommand = {
      type: "session.update",
      session: {
        turn_detection: {
          type: "server_vad",
        },
      },
    };

    if (enableInputAudioTranscription) {
      command.session.input_audio_transcription = {
        model: "whisper-1",
      };
    }

    sendJsonMessage(command);
  };

  const addUserAudio = (base64Audio: string) => {
    const command: InputAudioBufferAppendCommand = {
      type: "input_audio_buffer.append",
      audio: base64Audio,
    };

    sendJsonMessage(command);
  };

  const sendNameAndAssessmentId = (name: string, assessmentId: string) => {
    sendJsonMessage({
      name: name,
      assessment_id: assessmentId,
      for_init: true,
    });
  };

  const sendAssessmentAndQuestionId = (
    assessmentId: string,
    questionId: string
  ) => {
    sendJsonMessage({
      assessment_id: assessmentId,
      question_id: questionId,
      for_init: true,
    });
  };

  const initializeSession = () => {
    sendJsonMessage({
      for_init: true,
    });
  };

  const sendLessonItemId = (lessonItemId: string) => {
    sendJsonMessage({
      lesson_item_id: lessonItemId,
      for_init: true,
    });
  };

  const inputAudioBufferClear = () => {
    const command: InputAudioBufferClearCommand = {
      type: "input_audio_buffer.clear",
    };

    sendJsonMessage(command);
  };

  const onMessageReceived = (event: MessageEvent<any>) => {
    onWebSocketMessage?.(event);

    let message: Message;
    try {
      message = JSON.parse(event.data);
    } catch (e) {
      console.error("Failed to parse JSON message:", e);
      throw e;
    }

    if (JSON.parse(event.data)["score"] !== undefined) {
      onScoreUpdated?.(JSON.parse(event.data)["score"]);
    }
    console.log("message", message);

    switch (message.type) {
      case "user.id":
        setMyUserId?.(message.user_id);
        break;
      case "user.joined":
        onUserJoined?.(message.participant as Participant);
        break;
      case "participants.list":
        onParticipantsList?.(message.participants as Participant[]);
        break;
      case "participant.message":
        onParticipantMessage?.(message.message as Message, message.user_id);
        break;
      case "response.done":
        onReceivedResponseDone?.(message as ResponseDone);
        break;
      case "response.audio.delta":
        onReceivedResponseAudioDelta?.(message as ResponseAudioDelta);
        break;
      case "response.audio_transcript.delta":
        // case "transcript_delta":
        onReceivedResponseAudioTranscriptDelta?.(
          message as ResponseAudioTranscriptDelta
        );
        break;
      case "input_audio_buffer.speech_started":
        onReceivedInputAudioBufferSpeechStarted?.(message);
        break;
      case "conversation.item.input_audio_transcription.completed":
        onReceivedInputAudioTranscriptionCompleted?.(
          message as ResponseInputAudioTranscriptionCompleted
        );
        break;
      case "extension.middle_tier_tool_response":
        onReceivedExtensionMiddleTierToolResponse?.(
          message as ExtensionMiddleTierToolResponse
        );
        break;
      case "question_transition":
        onQuestionTransition?.(message);
        break;
      case "error":
        onReceivedError?.(message);
        break;
    }
  };

  return {
    startSession,
    addUserAudio,
    inputAudioBufferClear,
    sendAssessmentAndQuestionId,
    sendNameAndAssessmentId,
    sendJsonMessage,
    sendLessonItemId,
    initializeSession,
    setMyUserId,
  };
}
