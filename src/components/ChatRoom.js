import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./ChatRoom.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8080";

const ChatApp = () => {
    const [socket, setSocket] = useState(null);
    const [user, setUser] = useState({
        username: "",
        isConnected: false,
    });
    const [message, setMessage] = useState("");
    const [publicMessages, setPublicMessages] = useState([]);
    const [privateMessages, setPrivateMessages] = useState({});
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [selectedChat, setSelectedChat] = useState("public");
    const [previousUsers, setPreviousUsers] = useState([]);
    const messagesEndRef = useRef(null);

    // Initialize socket connection
    useEffect(() => {
        const newSocket = io(BACKEND_URL);
        setSocket(newSocket);

        // Load previous users from localStorage
        const savedUsers = localStorage.getItem("chatAppPreviousUsers");
        if (savedUsers) {
            setPreviousUsers(JSON.parse(savedUsers));
        }

        // Socket event listeners
        newSocket.on("connect", () => {
            console.log("Connected to socket server");
        });

        newSocket.on("connect_error", (error) => {
            console.error("Socket connection error:", error);
        });

        // Clean up on unmount
        return () => {
            newSocket.disconnect();
        };
    }, []);

    // Set up message handlers once socket and username are available
    useEffect(() => {
        if (!socket || !user.isConnected) return;

        // Handle user joining
        socket.on("userJoined", (data) => {
            console.log("User joined:", data.senderName);
            if (data.senderName && data.senderName !== user.username) {
                setOnlineUsers((prev) => {
                    if (!prev.includes(data.senderName)) {
                        return [...prev, data.senderName];
                    }
                    return prev;
                });
            }
        });

        // Handle user leaving
        socket.on("userLeft", (data) => {
            console.log("User left:", data.senderName);
            if (data.senderName) {
                setOnlineUsers((prev) => prev.filter(name => name !== data.senderName));
            }
        });

        // Handle public messages
        socket.on("message", (message) => {
            console.log("Received public message:", message);
            if (message && message.senderName && message.message) {
                setPublicMessages((prev) => [...prev, message]);
            }
        });

        // Handle private messages
        socket.on("privateMessage", (message) => {
            console.log("Received private message:", message);
            if (message && message.senderName && message.receiverName) {
                setPrivateMessages((prev) => {
                    const chatPartner = message.senderName === user.username ? message.receiverName : message.senderName;
                    const existingMessages = prev[chatPartner] || [];

                    return {
                        ...prev,
                        [chatPartner]: [...existingMessages, message]
                    };
                });

                // If the message is from someone we're not already chatting with
                // make sure they're in our online users list
                if (message.senderName !== user.username && !onlineUsers.includes(message.senderName)) {
                    setOnlineUsers(prev => [...prev, message.senderName]);
                }
            }
        });

        // Fetch existing messages and users when connecting
        const fetchInitialData = async () => {
            try {
                // Fetch public messages
                const messagesRes = await fetch(`${BACKEND_URL}/api/messages`);
                if (messagesRes.ok) {
                    const allMessages = await messagesRes.json();

                    // Filter public messages (no receiverName)
                    const public_msgs = allMessages.filter(msg => !msg.receiverName);
                    setPublicMessages(public_msgs);

                    // Organize private messages by chat partner
                    const private_msgs = allMessages.filter(msg =>
                        msg.receiverName && (msg.senderName === user.username || msg.receiverName === user.username)
                    );

                    const privateMessagesMap = {};

                    private_msgs.forEach(msg => {
                        const chatPartner = msg.senderName === user.username ? msg.receiverName : msg.senderName;
                        privateMessagesMap[chatPartner] = privateMessagesMap[chatPartner] || [];
                        privateMessagesMap[chatPartner].push(msg);
                    });

                    setPrivateMessages(privateMessagesMap);
                }

                // Fetch online users
                const usersRes = await fetch(`${BACKEND_URL}/api/users`);
                if (usersRes.ok) {
                    const users = await usersRes.json();
                    const otherUsers = users
                        .filter(u => u.username && u.username !== user.username)
                        .map(u => u.username);
                    setOnlineUsers(otherUsers);
                }
            } catch (error) {
                console.error("Error fetching initial data:", error);
            }
        };

        fetchInitialData();

        // Cleanup event listeners on component unmount or user change
        return () => {
            socket.off("userJoined");
            socket.off("userLeft");
            socket.off("message");
            socket.off("privateMessage");
        };
    }, [socket, user.isConnected, user.username, onlineUsers]);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [publicMessages, privateMessages, selectedChat]);

    // Handle user login
    const handleLogin = async () => {
        if (!user.username.trim()) {
            alert("Please enter a username");
            return;
        }

        try {
            // Register user with backend
            const response = await fetch(`${BACKEND_URL}/api/users`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username: user.username }),
            });

            if (!response.ok) {
                throw new Error("Failed to register user");
            }

            // Set connected state
            setUser(prev => ({ ...prev, isConnected: true }));

            // Send join event to socket
            socket.emit("join", { senderName: user.username });

            // Save to previous users if not already there
            if (!previousUsers.includes(user.username)) {
                const newPreviousUsers = [...previousUsers, user.username];
                localStorage.setItem("chatAppPreviousUsers", JSON.stringify(newPreviousUsers));
                setPreviousUsers(newPreviousUsers);
            }
        } catch (error) {
            console.error("Login error:", error);
            alert("Error logging in. Please try again.");
        }
    };

    // Handle selecting a previous user
    const selectPreviousUser = (username) => {
        setUser({ username, isConnected: false });
    };

    // Handle sending a message
    const sendMessage = () => {
        if (!message.trim()) return;

        if (selectedChat === "public") {
            // Send public message
            const messageData = {
                senderName: user.username,
                message: message,
                status: "SENT",
                timestamp: new Date().toISOString()
            };

            socket.emit("message", messageData);
        } else {
            // Send private message
            const messageData = {
                senderName: user.username,
                receiverName: selectedChat,
                message: message,
                status: "SENT",
                timestamp: new Date().toISOString()
            };

            socket.emit("privateMessage", messageData);
        }

        // Clear message input
        setMessage("");
    };

    // Handle pressing Enter to send message
    const handleKeyPress = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // Get current messages based on selected chat
    const getCurrentMessages = () => {
        if (selectedChat === "public") {
            return publicMessages;
        }
        return privateMessages[selectedChat] || [];
    };

    // Format timestamp
    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Safe method to get first character
    const getFirstChar = (str) => {
        return str && typeof str === 'string' && str.length > 0
            ? str.charAt(0).toUpperCase()
            : '?';
    };

    return (
        <div className="chat-container">
            {!user.isConnected ? (
                <div className="login-container">
                    <h1>Chat App</h1>

                    <div className="login-form">
                        <input
                            type="text"
                            placeholder="Enter your username"
                            value={user.username}
                            onChange={(e) => setUser({ ...user, username: e.target.value })}
                            onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                        />
                        <button onClick={handleLogin}>Join Chat</button>
                    </div>

                    {previousUsers.length > 0 && (
                        <div className="previous-users">
                            <h3>Previous Users</h3>
                            <div className="users-list">
                                {previousUsers.map((username, index) => (
                                    <div
                                        key={index}
                                        className="user-item"
                                        onClick={() => selectPreviousUser(username)}
                                    >
                                        {username}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="chat-interface">
                    <div className="sidebar">
                        <div className="user-info">
                            <div className="avatar">{getFirstChar(user.username)}</div>
                            <div className="username">{user.username}</div>
                        </div>

                        <div className="chats-list">
                            <div
                                className={`chat-item ${selectedChat === "public" ? "active" : ""}`}
                                onClick={() => setSelectedChat("public")}
                            >
                                <div className="chat-icon">🌐</div>
                                <div className="chat-name">Public Chat</div>
                            </div>

                            <div className="chat-divider">
                                <span>Direct Messages</span>
                            </div>

                            {onlineUsers.filter(username => username && typeof username === 'string').map((username, index) => (
                                <div
                                    key={index}
                                    className={`chat-item ${selectedChat === username ? "active" : ""}`}
                                    onClick={() => setSelectedChat(username)}
                                >
                                    <div className="user-avatar">{getFirstChar(username)}</div>
                                    <div className="chat-name">{username}</div>
                                    {privateMessages[username]?.some(msg =>
                                        msg.senderName !== user.username &&
                                        selectedChat !== username
                                    ) && (
                                            <div className="notification-badge"></div>
                                        )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="chat-main">
                        <div className="chat-header">
                            {selectedChat === "public" ? (
                                <>
                                    <div className="chat-icon">🌐</div>
                                    <div className="chat-title">Public Chat Room</div>
                                </>
                            ) : (
                                <>
                                    <div className="user-avatar">{getFirstChar(selectedChat)}</div>
                                    <div className="chat-title">{selectedChat}</div>
                                </>
                            )}
                        </div>

                        <div className="messages-container">
                            {getCurrentMessages().map((msg, index) => (
                                <div
                                    key={index}
                                    className={`message ${msg.senderName === user.username ? "self" : "other"}`}
                                >
                                    {msg.senderName !== user.username && (
                                        <div className="message-sender">
                                            <div className="sender-avatar">{getFirstChar(msg.senderName)}</div>
                                            <div className="sender-name">{msg.senderName}</div>
                                        </div>
                                    )}

                                    <div className="message-content">
                                        <div className="message-text">{msg.message}</div>
                                        <div className="message-time">{formatTime(msg.timestamp)}</div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="message-input">
                            <textarea
                                placeholder={`Message ${selectedChat === "public" ? "everyone" : selectedChat}...`}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                            />
                            <button onClick={sendMessage}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                                    <path fill="none" d="M0 0h24v24H0z" />
                                    <path d="M3.4 20.4L20.85 12.92c.8-.33.8-1.5 0-1.83L3.4 3.6c-.5-.2-1.03.08-1.2.6L1.1 9.8c-.1.36.05.74.34.9l5.3 2.3c.28.12.28.52 0 .64l-5.3 2.3c-.29.15-.44.53-.34.9l1.1 5.6c.17.5.7.8 1.2.6z" fill="currentColor" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatApp;