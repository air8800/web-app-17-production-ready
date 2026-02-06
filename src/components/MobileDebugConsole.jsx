import React, { useState, useEffect } from 'react';

/**
 * MobileDebugConsole - Floating on-screen console for mobile debugging
 * Shows performance timing logs directly on the screen
 */
const MobileDebugConsole = () => {
    const [logs, setLogs] = useState([]);
    const [isVisible, setIsVisible] = useState(true);
    const [isMinimized, setIsMinimized] = useState(false);

    useEffect(() => {
        // Intercept console.log
        const originalLog = console.log;

        console.log = (...args) => {
            // Call original console.log
            originalLog(...args);

            // Check if this is a timing/performance log (contains relevant emojis)
            const message = args.join(' ');
            if (message.includes('⏱️') || message.includes('📥') || message.includes('📊') || message.includes('⚡')) {
                const timestamp = new Date().toLocaleTimeString();
                setLogs(prev => [...prev.slice(-20), { // Keep last 20 logs only
                    time: timestamp,
                    message: message
                }]);
            }
        };

        // Cleanup
        return () => {
            console.log = originalLog;
        };
    }, []);

    if (!isVisible) return null;

    return (
        <div
            style={{
                position: 'fixed',
                bottom: isMinimized ? '10px' : '10px',
                right: '10px',
                width: isMinimized ? '60px' : '90%',
                maxWidth: '500px',
                maxHeight: isMinimized ? '60px' : '400px',
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                color: '#00ff00',
                padding: isMinimized ? '10px' : '15px',
                borderRadius: '8px',
                zIndex: 99999,
                fontFamily: 'monospace',
                fontSize: '11px',
                overflowY: isMinimized ? 'hidden' : 'auto',
                border: '2px solid #00ff00',
                boxShadow: '0 4px 12px rgba(0, 255, 0, 0.3)'
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: isMinimized ? '0' : '10px',
                    borderBottom: isMinimized ? 'none' : '1px solid #00ff00',
                    paddingBottom: isMinimized ? '0' : '5px'
                }}
            >
                <div style={{ fontWeight: 'bold', color: '#00ff00' }}>
                    {isMinimized ? '📱' : '📱 Mobile Debug Console'}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        style={{
                            background: 'none',
                            border: '1px solid #00ff00',
                            color: '#00ff00',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '10px'
                        }}
                    >
                        {isMinimized ? '▲' : '▼'}
                    </button>
                    <button
                        onClick={() => setLogs([])}
                        style={{
                            background: 'none',
                            border: '1px solid #ff6600',
                            color: '#ff6600',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '10px',
                            display: isMinimized ? 'none' : 'block'
                        }}
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => setIsVisible(false)}
                        style={{
                            background: 'none',
                            border: '1px solid #ff0000',
                            color: '#ff0000',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '10px',
                            display: isMinimized ? 'none' : 'block'
                        }}
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* Logs */}
            {!isMinimized && (
                <div style={{ fontSize: '10px', lineHeight: '1.4' }}>
                    {logs.length === 0 ? (
                        <div style={{ color: '#888', fontStyle: 'italic' }}>
                            Waiting for timing logs... Upload a PDF to see performance data.
                        </div>
                    ) : (
                        logs.map((log, index) => (
                            <div
                                key={index}
                                style={{
                                    marginBottom: '5px',
                                    padding: '5px',
                                    backgroundColor: 'rgba(0, 255, 0, 0.1)',
                                    borderRadius: '4px',
                                    borderLeft: '3px solid #00ff00'
                                }}
                            >
                                <div style={{ color: '#888', fontSize: '9px', marginBottom: '2px' }}>
                                    {log.time}
                                </div>
                                <div style={{ wordBreak: 'break-word' }}>
                                    {log.message}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Instructions */}
            {!isMinimized && logs.length === 0 && (
                <div style={{
                    marginTop: '15px',
                    padding: '10px',
                    backgroundColor: 'rgba(255, 166, 0, 0.1)',
                    borderRadius: '4px',
                    color: '#ffa600',
                    fontSize: '10px'
                }}>
                    <strong>📋 Instructions:</strong>
                    <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                        <li>Upload a PDF file</li>
                        <li>Watch for timing logs here</li>
                        <li>Look for "⏱️ [PDF PARSE COMPLETE]" to see parse time</li>
                        <li>Look for "⏱️ [GRID READY]" to see when grid should appear</li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default MobileDebugConsole;
