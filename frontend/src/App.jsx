import { useState, useEffect } from 'react';
import './App.css';

const API_BASE = 'http://localhost:5000/api';

function App() {
  const [channelName, setChannelName] = useState('');
  const [analysisId, setAnalysisId] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  // Poll analysis data every 2 seconds when connected
  useEffect(() => {
    let interval;
    
    if (analysisId && isConnected) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE}/analysis/${analysisId}`);
          if (response.ok) {
            const data = await response.json();
            setAnalysisData(data);
          }
        } catch (error) {
          console.error('Failed to fetch analysis data:', error);
        }
      }, 2000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [analysisId, isConnected]);

  const startAnalysis = async (useRealAPI = false) => {
    if (!channelName.trim()) {
      setError('Please enter a channel name');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const endpoint = useRealAPI ? 'start-analysis-real' : 'start-analysis-demo';
      const response = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channelName: channelName.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setAnalysisId(data.analysisId);
        setIsConnected(true);
        setError('');
      } else {
        setError(data.error || 'Failed to start analysis');
      }
    } catch (error) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const stopAnalysis = async () => {
    if (!analysisId) return;

    try {
      await fetch(`${API_BASE}/analysis/${analysisId}`, {
        method: 'DELETE',
      });
      
      setAnalysisId(null);
      setAnalysisData(null);
      setIsConnected(false);
      setChannelName('');
    } catch (error) {
      console.error('Failed to stop analysis:', error);
    }
  };

  const formatRuntime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="container">
          <h1 className="title">
            🤖 Kick Bot Detector
          </h1>
          <p className="subtitle">
            Real-time bot detection for Kick.com streams
          </p>
        </div>
      </header>

      <main className="main">
        <div className="container">
          
          {/* Connection Panel */}
          <div className="panel connection-panel">
            <h2>Channel Analysis</h2>
            
            {!isConnected ? (
              <div className="connect-form">
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="Enter Kick channel name (e.g. xqc)"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && startAnalysis()}
                    disabled={isLoading}
                    className="channel-input"
                  />
                  <div className="button-group">
                    <button
                      onClick={() => startAnalysis(false)}
                      disabled={isLoading || !channelName.trim()}
                      className="start-button demo"
                    >
                      {isLoading ? '🔄 Connecting...' : '🎮 Demo Mode'}
                    </button>
                    <button
                      onClick={() => startAnalysis(true)}
                      disabled={isLoading || !channelName.trim()}
                      className="start-button real"
                    >
                      {isLoading ? '🔄 Connecting...' : '🚀 Real Stream'}
                    </button>
                  </div>
                </div>
                
                {error && (
                  <div className="error-message">
                    ❌ {error}
                  </div>
                )}
              </div>
            ) : (
              <div className="connected-info">
                <div className="status-bar">
                  <span className="status-indicator">🟢 Connected to: <strong>{channelName}</strong></span>
                  <button onClick={stopAnalysis} className="stop-button">
                    🛑 Stop Analysis
                  </button>
                </div>
                
                {analysisData && (
                  <div className="runtime">
                    Runtime: {formatRuntime(analysisData.runtime)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Statistics Dashboard */}
          {analysisData && (
            <div className="dashboard">
              <div className="stats-grid">
                
                <div className="stat-card total-users">
                  <div className="stat-icon">👥</div>
                  <div className="stat-content">
                    <div className="stat-number">{analysisData.stats.uniqueUsers}</div>
                    <div className="stat-label">Total Users</div>
                  </div>
                </div>

                <div className="stat-card real-users">
                  <div className="stat-icon">✅</div>
                  <div className="stat-content">
                    <div className="stat-number">{analysisData.stats.realUsers}</div>
                    <div className="stat-label">Real Users</div>
                  </div>
                </div>

                <div className="stat-card bot-users">
                  <div className="stat-icon">🤖</div>
                  <div className="stat-content">
                    <div className="stat-number">{analysisData.stats.suspectedBots}</div>
                    <div className="stat-label">Suspected Bots</div>
                  </div>
                </div>

                <div className="stat-card bot-percentage">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <div className="stat-number">{analysisData.stats.botPercentage}%</div>
                    <div className="stat-label">Bot Percentage</div>
                  </div>
                </div>

              </div>

              {/* Bot Percentage Visualization */}
              <div className="panel">
                <h3>Bot vs Real Users</h3>
                <div className="progress-bar">
                  <div 
                    className="progress-fill-bots" 
                    style={{ width: `${analysisData.stats.botPercentage}%` }}
                  ></div>
                  <div 
                    className="progress-fill-real" 
                    style={{ 
                      width: `${100 - analysisData.stats.botPercentage}%`,
                      left: `${analysisData.stats.botPercentage}%`
                    }}
                  ></div>
                </div>
                <div className="progress-labels">
                  <span className="label-bots">🤖 Bots: {analysisData.stats.botPercentage}%</span>
                  <span className="label-real">✅ Real: {(100 - analysisData.stats.botPercentage).toFixed(1)}%</span>
                </div>
              </div>

              {/* Recent Bot Detections */}
              {analysisData.recentBots && analysisData.recentBots.length > 0 && (
                <div className="panel">
                  <h3>Recent Bot Detections</h3>
                  <div className="bot-list">
                    {analysisData.recentBots.map((bot, index) => (
                      <div key={index} className="bot-item">
                        <div className="bot-username">🤖 {bot.username}</div>
                        <div className="bot-confidence">
                          Confidence: {bot.confidence}%
                        </div>
                        <div className="bot-reasons">
                          {bot.reasons.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat Activity */}
              <div className="panel">
                <h3>Chat Activity</h3>
                <div className="activity-stats">
                  <div className="activity-item">
                    <span className="activity-label">💬 Total Messages:</span>
                    <span className="activity-value">{analysisData.stats.totalMessages}</span>
                  </div>
                  <div className="activity-item">
                    <span className="activity-label">⚡ Messages/Min:</span>
                    <span className="activity-value">
                      {analysisData.runtime > 0 ? Math.round((analysisData.stats.totalMessages / analysisData.runtime) * 60) : 0}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Info Panel */}
          <div className="panel info-panel">
            <h3>How it works</h3>
            <ul className="info-list">
              <li>🔍 Analyzes usernames for bot-like patterns</li>
              <li>📅 Checks account age and activity</li>
              <li>🎯 Real-time monitoring of chat messages</li>
              <li>📊 Calculates bot confidence scores</li>
              <li>⚡ Updates every 2 seconds</li>
            </ul>
          </div>

        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <p>Built with ❤️ for the streaming community | Not affiliated with Kick.com</p>
        </div>
      </footer>
    </div>
  );
}

export default App;