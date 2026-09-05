import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const CallContext = createContext(null);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  // Call state
  const [callState, setCallState] = useState('idle'); // idle, calling, ringing, connected
  const [callType, setCallType] = useState(null); // 'voice' | 'video'
  const [remoteUser, setRemoteUser] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const peerConnection = useRef(null);
  const callStateRef = useRef('idle');
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const durationInterval = useRef(null);
  const pendingSignalRef = useRef(null);
  const pendingCallTypeRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const callStatusTimeoutRef = useRef(null);
  const remoteUserIdRef = useRef(null);

  // Cleanup function
  const cleanupCall = useCallback(() => {
    if (callStatusTimeoutRef.current) {
      clearTimeout(callStatusTimeoutRef.current);
      callStatusTimeoutRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
      durationInterval.current = null;
    }
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setRemoteUser(null);
    setCallType(null);
    setCallDuration(0);
    setIsMicMuted(false);
    setIsVideoOff(false);
    setCallState('idle');
    callStateRef.current = 'idle';
    pendingSignalRef.current = null;
    pendingCallTypeRef.current = null;
    remoteUserIdRef.current = null;
  }, []);

  // Browser support check
  const isWebRTCSupported = useCallback(() => {
    const supported = !!(
      navigator.mediaDevices?.getUserMedia &&
      window.RTCPeerConnection
    );
    if (!supported) {
      toast.error('Voice/video calls are not supported on this browser or connection. Use HTTPS or localhost.');
    }
    return supported;
  }, []);

  // Get user media
  const getUserMedia = useCallback(async (video = false) => {
    if (!isWebRTCSupported()) throw new Error('WebRTC not supported');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Failed to get user media:', error);
      toast.error(
        error.name === 'NotAllowedError'
          ? 'Please allow microphone/camera access'
          : 'Could not access camera/microphone'
      );
      throw error;
    }
  }, []);

  // Create peer connection
  const createPeerConnection = useCallback((stream, isCaller, targetUserId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      if (event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        setRemoteStream(event.streams[0]);
      }
    };

    // Handle ICE candidates - use targetUserId directly (not state, to avoid stale closures)
    pc.onicecandidate = (event) => {
      if (event.candidate && socket?.connected && targetUserId) {
        socket.emit('webrtc:ice-candidate', {
          candidate: event.candidate,
          targetUserId,
        });
      }
    };

    // Connection state change
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        cleanupCall();
        toast.error('Call disconnected');
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [socket, cleanupCall]);

  // Start call duration timer
  const startDurationTimer = useCallback(() => {
    setCallDuration(0);
    durationInterval.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  const showCallOutcome = useCallback((nextState, message) => {
    setCallState(nextState);
    callStateRef.current = nextState;
    if (message) {
      toast(message, { icon: '📞' });
    }
    if (callStatusTimeoutRef.current) {
      clearTimeout(callStatusTimeoutRef.current);
    }
    callStatusTimeoutRef.current = setTimeout(() => {
      cleanupCall();
    }, 1800);
  }, [cleanupCall]);

  // Format duration
  const formatDuration = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Initiate a call
  const startCall = useCallback(async (targetUser, type) => {
    if (!socket?.connected) {
      toast.error('Not connected to server');
      return;
    }

    if (!targetUser || !targetUser._id) {
      toast.error('Please select a user to call');
      return;
    }

    try {
      const stream = await getUserMedia(type === 'video');
      const pc = createPeerConnection(stream, true, targetUser._id);

      setCallType(type);
      setRemoteUser(targetUser);
      remoteUserIdRef.current = targetUser._id;
      setCallState('calling');
      callStateRef.current = 'calling';

      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'calling') {
          showCallOutcome('missed', 'Missed call');
        }
      }, 30000);

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer via socket
      socket.emit('call:user', {
        receiverId: targetUser._id,
        signalData: { type: offer.type, sdp: offer.sdp },
        callType: type,
      });
    } catch (error) {
      cleanupCall();
    }
  }, [socket, getUserMedia, createPeerConnection, cleanupCall, showCallOutcome]);

  // Answer a call
  const answerCall = useCallback(async () => {
    const signalData = pendingSignalRef.current;
    const pendingType = pendingCallTypeRef.current;
    const targetId = remoteUserIdRef.current;

    if (!signalData) {
      toast.error('No incoming call data');
      return;
    }

    const video = pendingType === 'video';

    try {
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      const stream = await getUserMedia(video);
      const pc = createPeerConnection(stream, false, targetId);

      // Clear pending data
      pendingSignalRef.current = null;
      pendingCallTypeRef.current = null;

      // Set remote description (offer)
      await pc.setRemoteDescription(new RTCSessionDescription(signalData));

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Send answer via socket
      socket.emit('call:accepted', {
        signalData: { type: answer.type, sdp: answer.sdp },
        callerId: targetId,
      });

      setCallState('connected');
      callStateRef.current = 'connected';
      startDurationTimer();
    } catch (error) {
      console.error('Failed to answer call:', error);
      cleanupCall();
    }
  }, [socket, getUserMedia, createPeerConnection, startDurationTimer, cleanupCall]);

  // Reject a call
  const rejectCall = useCallback(() => {
    if (socket?.connected && remoteUser) {
      socket.emit('call:rejected', { callerId: remoteUser._id });
    }
    showCallOutcome('rejected', 'Call declined');
  }, [socket, remoteUser, showCallOutcome]);

  // End a call
  const endCall = useCallback(() => {
    if (socket?.connected && remoteUser) {
      socket.emit('call:ended', { targetUserId: remoteUser._id });
    }
    showCallOutcome('ended', 'Call ended');
  }, [socket, remoteUser, showCallOutcome]);

  // Toggle microphone
  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(async () => {
    if (!localStreamRef.current || !peerConnection.current) return;

    const currentTrack = localStreamRef.current.getVideoTracks()[0];
    const sender = peerConnection.current.getSenders().find((item) => item.track?.kind === 'video');
    if (!currentTrack) return;

    if (!isVideoOff) {
      try {
        if (sender) {
          await sender.replaceTrack(null);
        }
        currentTrack.stop();
      } catch (error) {
        console.error('Failed to stop video track:', error);
      }
      setIsVideoOff(true);
      return;
    }

    try {
      const freshStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const replacementTrack = freshStream.getVideoTracks()[0];

      if (sender && replacementTrack) {
        await sender.replaceTrack(replacementTrack);
      }

      const oldTrack = localStreamRef.current.getVideoTracks()[0];
      if (oldTrack) {
        localStreamRef.current.removeTrack(oldTrack);
        oldTrack.stop();
      }

      localStreamRef.current.addTrack(replacementTrack);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      setIsVideoOff(false);
    } catch (error) {
      console.error('Failed to re-enable video:', error);
      toast.error('Unable to turn the camera back on right now.');
    }
  }, [isVideoOff]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = async ({ callerId, callerName, callerAvatar, signalData, callType }) => {
      // Check if busy
      if (callStateRef.current !== 'idle') {
        socket.emit('call:unavailable', { callerId });
        return;
      }

      setRemoteUser({ _id: callerId, name: callerName, avatar: callerAvatar });
      setCallType(callType);
      setCallState('ringing');
      callStateRef.current = 'ringing';
      remoteUserIdRef.current = callerId;

      // Store signal data in refs for answering
      pendingSignalRef.current = signalData;
      pendingCallTypeRef.current = callType;

      callTimeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'ringing') {
          socket.emit('call:rejected', { callerId });
          showCallOutcome('missed', 'Missed call');
        }
      }, 30000);
    };

    const handleCallAccepted = async ({ signalData, accepterId }) => {
      if (callStateRef.current === 'calling' && peerConnection.current) {
        try {
          if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
          }
          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(signalData)
          );
          setCallState('connected');
          callStateRef.current = 'connected';
          startDurationTimer();
        } catch (error) {
          console.error('Failed to handle call accepted:', error);
          cleanupCall();
        }
      }
    };

    const handleCallRejected = ({ userId: rejectedBy }) => {
      if (callStateRef.current === 'calling') {
        showCallOutcome('rejected', 'Call declined');
      }
    };

    const handleCallEnded = () => {
      if (callStateRef.current === 'connected' || callStateRef.current === 'ringing' || callStateRef.current === 'calling') {
        showCallOutcome('ended', 'Call ended');
      }
    };

    const handleIceCandidate = async ({ candidate, userId: fromUserId }) => {
      if (peerConnection.current && candidate) {
        try {
          await peerConnection.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        } catch (error) {
          console.error('Failed to add ICE candidate:', error);
        }
      }
    };

    const handleUnavailable = ({ userId }) => {
      if (callStateRef.current === 'calling') {
        showCallOutcome('missed', 'User is busy on another call');
      }
    };

    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:accepted', handleCallAccepted);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:unavailable', handleUnavailable);
    socket.on('webrtc:ice-candidate', handleIceCandidate);

    return () => {
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:accepted', handleCallAccepted);
      socket.off('call:rejected', handleCallRejected);
      socket.off('call:ended', handleCallEnded);
      socket.off('call:unavailable', handleUnavailable);
      socket.off('webrtc:ice-candidate', handleIceCandidate);
    };
  }, [socket, startDurationTimer, cleanupCall, showCallOutcome]);

  const value = {
    callState,
    callType,
    remoteUser,
    localStream,
    remoteStream,
    isMicMuted,
    isVideoOff,
    callDuration,
    formatDuration,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMic,
    toggleVideo,
    cleanupCall,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};
