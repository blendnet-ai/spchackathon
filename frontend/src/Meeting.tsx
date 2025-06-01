"use client";

import useAudioPlayer from "@/hooks/useAudioPlayer";
import useAudioRecorder from "@/hooks/useAudioRecorder";
import useRealTime, { Participant } from "@/hooks/useRealtime";
import { MoreVertical, Mic, MicOff, VideoOff, Phone, Hand } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ScreenShareContent {
  participant: Participant;
  image: string;
}
const p = (index: number) => {
  const audioUrls: string[] = [
    "https://diystg.blob.core.windows.net/tst/audio1.mp3",
    "https://diystg.blob.core.windows.net/tst/ElevenLabs_2025-06-01T06_17_50_Anika - Sweet & Lively Social Media Voice_pvc_sp94_s61_sb33_se0_q50_b_m2.mp3",
    "https://diystg.blob.core.windows.net/tst/Anika Sweet Lively Voice June 2025.mp3",
    "https://diystg.blob.core.windows.net/tst/Anika Sweet Lively Voice June 2025 (1).mp3",
    "https://diystg.blob.core.windows.net/tst/Anika Sweet Lively Voice June 2025 (1).mp3",
  ];

  console.log("index", index);

  if (index < 0 || index >= audioUrls.length) {
    console.error("Invalid index provided");
    return;
  }

  const audio = new Audio(audioUrls[index]);
  audio.play().catch((error) => {
    console.error("Error playing audio:", error);
  });
};

// Expose the function to window object
(window as any).p = p;

export default function HackathonMeeting() {
  // const participants: Participant[] = [
  //   {
  //     id: 1,
  //     name: "Munashe",
  //     avatar: "/placeholder.svg?height=80&width=80",
  //     isMuted: true,
  //     isActive: false,
  //   },
  //   {
  //     id: 2,
  //     name: "Dalitso",
  //     avatar: "/placeholder.svg?height=80&width=80",
  //     isMuted: false,
  //     isActive: false,
  //   },
  //   {
  //     id: 3,
  //     name: "Mavis",
  //     avatar: "/placeholder.svg?height=80&width=80",
  //     isMuted: true,
  //     isActive: false,
  //   },
  //   {
  //     id: 4,
  //     name: "Mathious",
  //     avatar: "/placeholder.svg?height=80&width=80",
  //     isMuted: true,
  //     isActive: false,
  //   },
  //   {
  //     id: 4,
  //     name: "Mathious",
  //     avatar: "/placeholder.svg?height=80&width=80",
  //     isMuted: true,
  //     isActive: false,
  //   },
  // ];

  const aiParticipant: Participant = {
    id: 10000,
    name: "AI",
    avatar: "/placeholder.svg?height=80&width=80",
    isMuted: true,
    isActive: false,
  };

  const [participants, setParticipants] = useState<Participant[]>([
    aiParticipant,
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [lastFiveWords, setLastFiveWords] = useState<string[]>([]);
  const pendingDeltaRef = useRef<string | null>(null);
  const hasReceivedAllDeltasRef = useRef(false);
  const [dotIndex, setDotIndex] = useState(0);

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {}, []);
  // const [screenShareContent, setScreenShareContent] =
  //   useState<ScreenShareContent | null>({
  //     participant: participants[0],
  //     image:
  //       "https://diystg.blob.core.windows.net/short-videos/chapter-thumbnail.svg",
  //   });

  const [screenShareContent, setScreenShareContent] =
    useState<ScreenShareContent | null>(null);

  const {
    startSession,
    addUserAudio,
    // inputAudioBufferClear,
    // sendNameAndAssessmentId,
    // sendJsonMessage,
    initializeSession,
  } = useRealTime({
    setMyUserId: (userId) => {
      setUserId(userId);
    },
    onParticipantsList: (participants) => {
      setParticipants([aiParticipant, ...participants]);
    },
    onParticipantMessage: (message, userid) => {
      console.log("onParticipantMessage", userid);
      setParticipants((prevParticipants) =>
        prevParticipants.map((participant) =>
          participant.id === Number(userid)
            ? { ...participant, isActive: true }
            : { ...participant, isActive: false }
        )
      );

      const newMsg = JSON.parse(message);
      console.log("new Msg", newMsg);
      if (userid === userId) return;

      // Set the participant as active

      console.log("newMsg.audio", newMsg.audio);

      if (hasReceivedAllDeltasRef.current) {
        console.log("last play");

        setParticipants((prevParticipants) =>
          prevParticipants.map((participant) =>
            participant.id === Number(userid)
              ? { ...participant, isActive: false }
              : participant
          )
        );

        playAudio(newMsg.audio, true);
        hasReceivedAllDeltasRef.current = false;
      } else {
        // Just play it normally
        console.log("normal play");
        playAudio(newMsg.audio, false);
        // Store it in case it was the last one
        pendingDeltaRef.current = newMsg.audio;
      }
    },
    onUserJoined: (participant) => {
      console.log("participant", participant);
      if (!participants.some((p) => p.id === participant.id)) {
        setParticipants([...participants, participant]);
      }
    },

    skipToken: false,
    url: `${import.meta.env.VITE_MEETING_REALTIME_URL}`,
    onWebSocketOpen: async () => {
      console.log("WebSocket connection opened");
      initializeSession();

      // startSession();
      // resetAudioPlayer();
      // hasReceivedAllDeltasRef.current = false;
      // pendingDeltaRef.current = null;

      console.log("Starting conversation");
    },
    // onQuestionTransition: (message) => {
    //   setCurrentQuestionIndex(message.data.next_index);
    // },
    // onWebSocketClose: () => console.log("WebSocket connection closed"),
    // onWebSocketError: (event) => console.error("WebSocket error:", event),
    // onReceivedError: (message) => console.error("error", message),
    onReceivedResponseAudioDelta: (message) => {
      console.log("onReceivedResponseAudioDelta", message);
      // if (isRecording) {
      setIsAiSpeaking(true);

      // If we already know this is the last delta (done was received), play it as last
      if (hasReceivedAllDeltasRef.current) {
        console.log("last play");
        playAudio(message.delta, true);
        hasReceivedAllDeltasRef.current = false;
      } else {
        // Just play it normally
        console.log("normal play");
        playAudio(message.delta, false);
        // Store it in case it was the last one
        pendingDeltaRef.current = message.delta;
      }
      // }
    },
    // onReceivedResponseDone: () => {
    //   // If we have a pending delta, it was the last one - update the queued duration
    //   if (pendingDeltaRef.current && isRecording) {
    //     // Don't replay, just update the duration tracking for the last played buffer
    //     playAudio(pendingDeltaRef.current, true, true);
    //     pendingDeltaRef.current = null;
    //   } else {
    //     // If no pending delta, mark that the next delta should be played as last
    //     hasReceivedAllDeltasRef.current = true;
    //   }
    // },
    // onReceivedInputAudioBufferSpeechStarted: () => {
    //   console.log("onReceivedInputAudioBufferSpeechStarted");
    //   setIsAiSpeaking(false);
    //   hasReceivedAllDeltasRef.current = false;
    //   pendingDeltaRef.current = null;
    //   stopAudioPlayer();
    // },
  });

  const {
    reset: resetAudioPlayer,
    play: playAudio,
    stop: stopAudioPlayer,
  } = useAudioPlayer({
    onLastBufferComplete: () => {
      setIsAiSpeaking(false);
    },
  });
  const { start: startAudioRecording, stop: stopAudioRecording } =
    useAudioRecorder({ onAudioRecorded: addUserAudio });

  const onToggleListening = async () => {
    if (!isRecording) {
      // if (interviewEnded) {
      //   return;
      // }
      console.log("Starting conversation");
      // await startAudioRecording();
      // setIsRecording(true);
      startSession();
      await startAudioRecording();
      resetAudioPlayer();
      hasReceivedAllDeltasRef.current = false;
      pendingDeltaRef.current = null;
      setIsRecording(true);
    } else {
      console.log("Stopping conversation");
      await stopAudioRecording();
      setIsRecording(false);
    }
  };

  return (
    <div
      className="bg-gray-900 p-4 flex flex-col gap-8 h-screen"
      data-testid="hackathon-meeting"
    >
      {/* <div>User id: {userId}</div> */}

      {/* Participants Grid */}
      {screenShareContent && (
        <div className="flex flex-col h-full">
          <div className="flex-1 max-h-[60vh] rounded-lg flex flex-col bg-black">
            <img
              src={screenShareContent.image}
              alt={screenShareContent.participant.name}
              className="w-full h-full object-contain rounded-lg "
            />
          </div>
          <div className="flex overflow-x-auto space-x-4 mt-4 pb-2">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className={`bg-gray-800 rounded-lg flex flex-col  aspect-square p-2 h-[120px] ${
                  participant.isActive ? "ring-2 ring-blue-500" : ""
                }`}
              >
                <div className="top-3 right-12 bg-gray-700 rounded-full p-1.5 ml-auto mb-2 invisible">
                  {participant.isMuted ? (
                    <MicOff className="w-2 h-2 text-white" />
                  ) : (
                    <Mic className="w-2 h-2 text-white" />
                  )}
                </div>

                <div className="mx-auto">
                  <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center">
                    <span className="text-white text-2xl font-semibold">
                      {participant.name.charAt(0)}
                    </span>
                  </div>
                </div>

                <div className="text-center mt-2">
                  <h3 className="text-white text-lg font-medium">
                    {participant.name}
                  </h3>
                </div>

                {/* Active Indicator */}
              </div>
            ))}
          </div>
        </div>
      )}
      {!screenShareContent && (
        <div className="flex flex-wrap gap-4 justify-center ">
          {participants.map((participant) => (
            <div
              key={participant.id}
              className={`bg-gray-800 rounded-lg flex flex-col p-2 h-[180px] lg:h-[20vw] ${
                participant.isActive ? "ring-2 ring-blue-500" : ""
              } ${
                window.innerWidth >= 1024 ? "aspect-[12/8]" : "aspect-square"
              }`}
            >
              <div className="top-3 right-12 bg-gray-700 rounded-full p-1.5 ml-auto mb-2 invisible">
                {participant.isMuted ? (
                  <MicOff className="w-4 h-4 text-white" />
                ) : (
                  <Mic className="w-4 h-4 text-white" />
                )}
              </div>

              <div className="mx-auto">
                <div className="w-16 h-16 rounded-full bg-orange-600 flex items-center justify-center">
                  <span className="text-white text-2xl font-semibold">
                    {participant.name.charAt(0)}
                  </span>
                </div>
              </div>

              <div className="text-center mt-4">
                <h3 className="text-white text-lg font-medium">
                  {participant.name}
                </h3>
              </div>

              {/* Active Indicator */}
            </div>
          ))}
        </div>
      )}

      {/* Control Bar */}
      <div className="flex justify-center items-center space-x-4 mt-auto mb-4">
        {/* End Call */}

        {/* Camera Toggle */}
        <div className="relative">
          <button className="bg-white hover:bg-gray-100 rounded-full p-4 transition-colors">
            <VideoOff className="w-6 h-6 text-gray-800" />
          </button>
          {/* Notification Badge */}
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            1
          </div>
        </div>

        {/* Microphone Toggle */}
        <button
          onClick={onToggleListening}
          className="bg-white hover:bg-gray-100 rounded-full p-4 transition-colors"
        >
          {isRecording ? (
            <Mic className="h-10 w-10 text-gray-700" />
          ) : (
            <MicOff className="h-10 w-10 text-gray-700" />
          )}
        </button>
        <button className="bg-red-500 hover:bg-red-600 rounded-full p-4 transition-colors">
          <Phone className="w-6 h-6 text-white" />
        </button>
      </div>
    </div>
  );
}
