import { useEffect, useRef } from 'react';
import { useCall } from '../../context/CallContext';
import { getInitials, stringToColor } from '../../utils/helpers';
import {
  FiPhone,
  FiPhoneOff,
  FiVideo,
  FiVideoOff,
  FiMic,
  FiMicOff,
  FiX,
} from 'react-icons/fi';

const CallModal = () => {
  const {
    callState,
    callType,
    remoteUser,
    localStream,
    remoteStream,
    isMicMuted,
    isVideoOff,
    callDuration,
    formatDuration,
    answerCall,
    rejectCall,
    endCall,
    toggleMic,
    toggleVideo,
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (callState === 'idle') return null;

  const isCaller = callState === 'calling';
  const isRinging = callState === 'ringing';
  const isConnected = callState === 'connected';
  const isMissed = callState === 'missed';
  const isRejected = callState === 'rejected';
  const isEnded = callState === 'ended';

  // Answer incoming call
  const handleAnswer = () => {
    answerCall();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      {/* Call Container */}
      <div className={`relative rounded-2xl overflow-hidden shadow-2xl ${
        callType === 'video' ? 'w-full max-w-4xl h-[80vh]' : 'w-full max-w-sm'
      } mx-4 bg-dark-900`}>
        {/* Remote Video (full background for video calls) */}
        {isConnected && callType === 'video' && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Content overlay */}
        <div className={`relative z-10 flex flex-col h-full ${
          isConnected && callType === 'video' ? 'bg-black/40' : 'bg-dark-900'
        }`}>
          {/* Header */}
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            {/* Remote user avatar (for voice calls / ringing) */}
            {(!isConnected || callType === 'voice') && (
              <div className="mb-4">
                {remoteUser?.avatar ? (
                  <img
                    src={remoteUser.avatar}
                    alt={remoteUser.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white/20 shadow-xl"
                  />
                ) : (
                  <div
                    className="w-24 h-24 rounded-full flex items-center justify-center text-white text-4xl font-bold border-4 border-white/20 shadow-xl"
                    style={{ backgroundColor: stringToColor(remoteUser?.name) }}
                  >
                    {getInitials(remoteUser?.name)}
                  </div>
                )}
              </div>
            )}

            {/* User name */}
            <h3 className="text-xl font-semibold text-white mb-1">
              {remoteUser?.name || 'Unknown'}
            </h3>

            {/* Call status */}
            <p className="text-sm text-gray-300 mb-6">
              {isCaller && 'Calling...'}
              {isRinging && 'Incoming call'}
              {isConnected && formatDuration(callDuration)}
              {isMissed && 'Missed call'}
              {isRejected && 'Call declined'}
              {isEnded && 'Call ended'}
            </p>

            {/* Local video preview (pip) */}
            {isConnected && callType === 'video' && (
              <div className="absolute top-4 right-4 w-32 h-24 rounded-lg overflow-hidden border-2 border-white/30 shadow-lg bg-black/70">
                {localStream && !isVideoOff ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-center px-2 text-[10px] font-medium text-white/80">
                    Camera Off
                  </div>
                )}
              </div>
            )}

            {/* Ringing animation */}
            {isRinging && (
              <div className="flex gap-3 mb-8">
                <button
                  onClick={handleAnswer}
                  className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shadow-lg transition-all hover:scale-105 active:scale-95"
                >
                  <FiPhone className="w-6 h-6" />
                </button>
                <button
                  onClick={rejectCall}
                  className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition-all hover:scale-105 active:scale-95"
                >
                  <FiPhoneOff className="w-6 h-6" />
                </button>
              </div>
            )}

            {/* Calling animation */}
            {isCaller && (
              <div className="flex gap-1 mb-8">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-green-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Controls bar */}
          {(isCaller || isConnected) && !isRinging && !isMissed && !isRejected && !isEnded && (
            <div className="flex-shrink-0 px-6 py-4 bg-black/30 backdrop-blur-sm">
              <div className="flex items-center justify-center gap-4">
                {/* Mute button */}
                <button
                  onClick={toggleMic}
                  className={`p-3 rounded-full transition-all ${
                    isMicMuted
                      ? 'bg-red-500 text-white'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                  title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {isMicMuted ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
                </button>

                {/* Video toggle (only for video calls) */}
                {callType === 'video' && (
                  <button
                    onClick={toggleVideo}
                    className={`p-3 rounded-full transition-all ${
                      isVideoOff
                        ? 'bg-red-500 text-white'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                    title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                  >
                    {isVideoOff ? <FiVideoOff className="w-5 h-5" /> : <FiVideo className="w-5 h-5" />}
                  </button>
                )}

                {/* End call button */}
                <button
                  onClick={endCall}
                  className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg transition-all hover:scale-105 active:scale-95"
                  title="End call"
                >
                  <FiPhoneOff className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallModal;
