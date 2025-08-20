import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import axios from 'axios';
import './App.css';

// Define the Text interface to match the backend
interface Text {
  id: number;
  text: string;
  timestamp: string;
  imageUrl: string;
  fileName: string;
  fileId: string;
}

// Define the Stage interface for progress tracking
interface Stage {
  id: string;
  stage: string;
  message: string;
  timestamp: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error' | 'final';
}

// Define the SSE message interface
interface SSEMessage {
  type: string;
  id?: string;
  stage?: string;
  message?: string;
  timestamp?: string;
  status?: 'pending' | 'in-progress' | 'completed' | 'error' | 'final';
}

function App(): JSX.Element {
  const [texts, setTexts] = useState<Text[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [currentStage, setCurrentStage] = useState<Stage | null>(null);
  const [stageHistory, setStageHistory] = useState<Stage[]>([]);
  const [isStageHistoryOpen, setIsStageHistoryOpen] = useState<boolean>(false);

  // Fetch texts on component mount
  useEffect(() => {
    console.log('App component mounted, setting up SSE and fetching texts...');
    fetchTexts();
    const cleanup = setupSSE();

    // Cleanup function
    return () => {
      console.log('App component unmounting, cleaning up SSE...');
      if (cleanup) cleanup();
    };
  }, []);

  const setupSSE = () => {
    console.log('Setting up SSE connection...');
    // Use the full backend URL for SSE connection to avoid proxy issues
    const eventSource = new EventSource('http://localhost:3001/api/progress');

    eventSource.onopen = (event) => {
      console.log('SSE connection opened:', event);
    };

    eventSource.onmessage = (event) => {
      console.log('SSE message received:', event.data);
      try {
        const data: SSEMessage = JSON.parse(event.data);
        console.log('Parsed SSE data:', data);

        if (data.type === 'stage-update' && data.id && data.stage && data.message && data.timestamp && data.status) {
          const stage: Stage = {
            id: data.id,
            stage: data.stage,
            message: data.message,
            timestamp: data.timestamp,
            status: data.status
          };

          console.log('Processing stage update:', stage);
          setCurrentStage(stage);
          setStageHistory(prev => [...prev, stage]);

          // Clear current stage after a delay if finalized or error
          if (stage.status === 'final' || stage.status === 'error') {
            if (stage.stage === 'final') {
              // Keep the final completion stage visible indefinitely
              // It will be cleared when a new process starts (in handleSubmit)
            } else {
              // Clear intermediate completed/error stages after 3 seconds
              setTimeout(() => {
                setCurrentStage(null);
              }, 3000);
            }
          }
        } else if (data.type === 'connected') {
          console.log('SSE connection established:', data.message);
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      eventSource.close();
      // Attempt to reconnect after a delay
      setTimeout(() => {
        console.log('Attempting to reconnect SSE...');
        setupSSE();
      }, 5000);
    };

    return () => {
      console.log('Closing SSE connection...');
      eventSource.close();
    };
  };

  const fetchTexts = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await axios.get<{ texts: Text[] }>('/api/texts');
      setTexts(response.data.texts);
      setError('');
    } catch (err) {
      setError('Failed to fetch texts');
      console.error('Error fetching texts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!inputText.trim()) {
      setError('Please enter some text');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setStageHistory([]); // Clear previous stage history
      setCurrentStage(null); // Clear any previous current stage

      const response = await axios.post<Text>('/api/texts', { text: inputText });
      setTexts(prevTexts => [...prevTexts, response.data]);
      setInputText('');
    } catch (err) {
      setError('Failed to submit text');
      console.error('Error submitting text:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setInputText(e.target.value);
  };

  const formatDate = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getStageIcon = (status: string): string => {
    switch (status) {
      case 'final':
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      case 'in-progress':
        return '⏳';
      default:
        return '⏸️';
    }
  };

  const getStageColor = (status: string): string => {
    switch (status) {
      case 'final':
      case 'completed':
        return '#4caf50';
      case 'error':
        return '#f44336';
      case 'in-progress':
        return '#2196f3';
      default:
        return '#9e9e9e';
    }
  };

  const toggleStageHistory = () => {
    setIsStageHistoryOpen(!isStageHistoryOpen);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>ATXP Agent Demo</h1>
        <p>Use an ATXP agent to create an image from text and share it with the world.</p>
      </header>

      <main className="App-main">
        <form onSubmit={handleSubmit} className="text-form">
          <div className="input-group">
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder="Enter your text here..."
              className="text-input"
              disabled={loading}
            />
            <button
              type="submit"
              className="submit-button"
              disabled={loading || !inputText.trim()}
            >
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>

        {error && <div className="error-message">{error}</div>}

        {/* Progress Indicator */}
        {currentStage && (
          <div className="progress-indicator">
            <h3>Current Progress</h3>
            <div
              className="current-stage"
              style={{ borderLeftColor: getStageColor(currentStage.status) }}
            >
              <div className="stage-header">
                <span className="stage-icon">{getStageIcon(currentStage.status)}</span>
                <span className="stage-name">{currentStage.stage}</span>
              </div>
              <p className="stage-message">{currentStage.message}</p>
              <small className="stage-timestamp">
                {formatDate(currentStage.timestamp)}
              </small>
            </div>
          </div>
        )}

        {/* Stage History Accordion */}
        {stageHistory.length > 0 && (
          <div className="stage-history-accordion">
            <button
              className="accordion-header"
              onClick={toggleStageHistory}
              aria-expanded={isStageHistoryOpen}
            >
              <h3>Process History ({stageHistory.length})</h3>
              <span className="accordion-icon">
                {isStageHistoryOpen ? '▼' : '▶'}
              </span>
            </button>
            <div className={`accordion-content ${isStageHistoryOpen ? 'open' : ''}`}>
              <div className="stages-list">
                {stageHistory.map((stage, index) => (
                  <div
                    key={`${stage.id}-${index}`}
                    className="stage-item"
                    style={{ borderLeftColor: getStageColor(stage.status) }}
                  >
                    <div className="stage-header">
                      <span className="stage-icon">{getStageIcon(stage.status)}</span>
                      <span className="stage-name">{stage.stage}</span>
                    </div>
                    <p className="stage-message">{stage.message}</p>
                    <small className="stage-timestamp">
                      {formatDate(stage.timestamp)}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="texts-container">
          <h2>Previous Submissions</h2>
          {loading && texts.length === 0 ? (
            <p>Loading...</p>
          ) : texts.length === 0 ? (
            <p>No texts submitted yet.</p>
          ) : (
            <div className="texts-list">
              {texts.map((text) => (
                <div key={text.id} className="text-item">
                  <p className="text-content">{text.text}</p>
                  {text.imageUrl && (
                    <figure>
                      <img src={text.imageUrl} alt={text.text} className="text-image" />
                      <figcaption>{text.fileName}</figcaption>
                    </figure>
                  )}
                  <small className="text-timestamp">
                    Submitted: {formatDate(text.timestamp)}
                  </small>
                  {text.fileId && (
                    <small className="text-fileId">
                      File ID: {text.fileId}
                    </small>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
