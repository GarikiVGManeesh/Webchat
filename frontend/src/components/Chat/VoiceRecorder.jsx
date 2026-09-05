import { useState, useRef } from 'react';
import { FiMic, FiSquare, FiSend } from 'react-icons/fi';

const VoiceRecorder = ({ onSendVoice, disabled }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setRecordingTime(0);
  };

  const sendVoiceMessage = () => {
    if (audioBlob && onSendVoice) {
      onSendVoice(audioBlob, recordingTime);
      setAudioBlob(null);
      setRecordingTime(0);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (audioBlob) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={cancelRecording}
          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
          title="Cancel"
        >
          <FiSquare className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <audio src={URL.createObjectURL(audioBlob)} controls className="h-8 w-full" />
        </div>
        <span className="text-xs text-gray-500">{formatTime(recordingTime)}</span>
        <button
          type="button"
          onClick={sendVoiceMessage}
          className="p-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-all"
          title="Send voice message"
        >
          <FiSend className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm text-red-500 font-medium">Recording... {formatTime(recordingTime)}</span>
        </div>
        <button
          type="button"
          onClick={stopRecording}
          className="p-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
          title="Stop recording"
        >
          <FiSquare className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startRecording}
      disabled={disabled}
      className="p-2.5 text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-primary-500/10 dark:hover:bg-white/5 rounded-lg transition-all disabled:opacity-50"
      title="Record voice message"
    >
      <FiMic className="w-5 h-5" />
    </button>
  );
};

export default VoiceRecorder;
