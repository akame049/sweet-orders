import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { io } from 'socket.io-client';

const SOCKET_URL = 'https://sweet-orders-u2ai.onrender.com';
const API_URL = 'https://sweet-orders-u2ai.onrender.com/api';

const ChatPage = () => {
    const { user } = useAuth();
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [connected, setConnected] = useState(false);
    const socketRef = useRef(null);
    const bottomRef = useRef(null);

    useEffect(() => {
        // Încarcă mesajele vechi
        fetch(`${API_URL}/chat/messages`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => setMessages(Array.isArray(data) ? data : []));

        // Conectare Socket.io
        const socket = io(SOCKET_URL, {
            withCredentials: true,
            transports: ['websocket', 'polling'] 
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            setConnected(true);
            socket.emit('chat:join', { username: user.username, userId: user.id, roles: user.roles });
        });

        socket.on('disconnect', () => setConnected(false));

        socket.on('chat:message', (message) => {
            setMessages(prev => [...prev, message]);
        });

        socket.on('chat:userJoined', (data) => {
            setMessages(prev => [...prev, {
                system: true,
                text: `${data.username} a intrat în chat`,
                timestamp: data.timestamp
            }]);
        });

        socket.on('chat:userLeft', (data) => {
            setMessages(prev => [...prev, {
                system: true,
                text: `${data.username} a părăsit chat-ul`,
                timestamp: data.timestamp
            }]);
        });

        return () => socket.disconnect();
    }, [user]);

    // Auto-scroll la ultimul mesaj
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = (e) => {
        e.preventDefault();
        if (text.trim() && connected) {
            socketRef.current.emit('chat:message', {
                text: text,
                username: user.username,
                userId: user.id,
                roles: user.roles
            });
            setText('');
        }
    };

    const formatTime = (ts) => {
        if (!ts) return '';
        return new Date(ts).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="chat-container fade-in">
            <div className="chat-header">
                <h2>💬 Chat Live</h2>
                <span className={`chat-status ${connected ? 'connected' : 'disconnected'}`}>
                    {connected ? '🟢 Conectat' : '🔴 Deconectat'}
                </span>
            </div>

            <div className="chat-messages">
                {messages.map((msg, index) => (
                    <div key={msg._id || msg.timestamp || index} className={`chat-message ${msg.username === user.username ? 'own' : 'other'}`}>
                        <div className="chat-bubble">
                            <div className="chat-meta">
                                <span className="chat-username">{msg.username}</span>
                                <span className="chat-time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p>{msg.text}</p>
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            <form onSubmit={sendMessage} className="chat-input-form">
                <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Scrie un mesaj..."
                    className="chat-input"
                />
                <button type="submit" className="btn-primary" disabled={!connected}>
                    Trimite
                </button>
            </form>
        </div>
    );
};

export default ChatPage;