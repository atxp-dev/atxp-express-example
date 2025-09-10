import React, { useState, useEffect, useCallback, useRef, FormEvent, ChangeEvent } from 'react';
import axios from 'axios';
import './App.css';

// Define the Text interface to match the backend
interface Text {
  id: number;
  text: string;
  timestamp: string;
  imageUrl: string;
  fileName: string;
  fileId?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  taskId?: string;
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
  payment?: {
    accountId: string;
    resourceUrl: string;
    resourceName: string;
    network: string;
    currency: string;
    amount: string;
    iss: string;
  };
}

function App(): JSX.Element {
  const [texts, setTexts] = useState<Text[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [currentStage, setCurrentStage] = useState<Stage | null>(null);
  const [stageHistory, setStageHistory] = useState<Stage[]>([]);
  const [isStageHistoryOpen, setIsStageHistoryOpen] = useState<boolean>(false);
  const [payments, setPayments] = useState<NonNullable<SSEMessage['payment']>[]>([]);
  const [isPaymentsOpen, setIsPaymentsOpen] = useState<boolean>(false);
  
  // ATXP connection string state
  const [connectionString, setConnectionString] = useState<string>('');
  const [showConnectionPrompt, setShowConnectionPrompt] = useState<boolean>(false);
  const [connectionStringInput, setConnectionStringInput] = useState<string>('');
  const [connectionValidating, setConnectionValidating] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string>('');

  // SSE connection ref to handle StrictMode mounting/unmounting
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load connection string from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('atxp-connection-string');
    if (saved) {
      setConnectionString(saved);
      setConnectionStringInput(saved);
    } else {
      setShowConnectionPrompt(true);
    }
  }, []);

  // Validate connection string format (should be a URL)
  const isValidConnectionStringFormat = (connectionString: string): boolean => {
    try {
      new URL(connectionString);
      return true;
    } catch {
      return false;
    }
  };

  // Validate connection string with backend
  const validateConnection = useCallback(async (testConnectionString: string): Promise<boolean> => {
    if (!testConnectionString.trim()) {
      setConnectionError('Connection string is required');
      return false;
    }

    // First validate URL format
    if (!isValidConnectionStringFormat(testConnectionString)) {
      setConnectionError('Connection string must be a valid URL (e.g., https://accounts.atxp.ai/connection-string/...)');
      return false;
    }

    try {
      setConnectionValidating(true);
      setConnectionError('');
      
      const response = await axios.get('/api/validate-connection', {
        headers: {
          'x-atxp-connection-string': testConnectionString
        }
      });
      
      return response.data.valid;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to validate connection string';
      setConnectionError(errorMessage);
      return false;
    } finally {
      setConnectionValidating(false);
    }
  }, []);

  // Save and set connection string
  const saveConnectionString = useCallback(async () => {
    const isValid = await validateConnection(connectionStringInput);
    if (isValid) {
      setConnectionString(connectionStringInput);
      localStorage.setItem('atxp-connection-string', connectionStringInput);
      setShowConnectionPrompt(false);
      setConnectionError('');
    }
  }, [connectionStringInput, validateConnection]);

  // Clear connection string
  const clearConnectionString = useCallback(() => {
    setConnectionString('');
    setConnectionStringInput('');
    localStorage.removeItem('atxp-connection-string');
    setShowConnectionPrompt(true);
    setConnectionError('');
  }, []);

  const fetchTexts = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const headers = connectionString ? { 'x-atxp-connection-string': connectionString } : {};
      const response = await axios.get<{ texts: Text[] }>('/api/texts', { headers });
      setTexts(response.data.texts);
      setError('');
    } catch (err) {
      setError('Failed to fetch texts');
      console.error('Error fetching texts:', err);
    } finally {
      setLoading(false);
    }
  }, [connectionString]);

  const setupSSE = useCallback(() => {
    // Close existing connection if it exists
    if (eventSourceRef.current) {
      console.log('Closing existing SSE connection...');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    console.log('Setting up SSE connection...');
    
    // Use NODE_ENV to determine if we're in development mode with separate servers
    // In development, we typically run frontend and backend on separate ports
    // In production, they're served from the same domain
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    let sseUrl: string;
    if (isDevelopment) {
      // Development: use direct backend URL since CRA proxy doesn't handle SSE well
      const backendPort = process.env.REACT_APP_BACKEND_PORT || '3001';
      sseUrl = `http://localhost:${backendPort}/api/progress`;
    } else {
      // Production/deployed: use relative URL (same origin)
      sseUrl = '/api/progress';
    }
    
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;
    
    console.log('EventSource created, readyState:', eventSource.readyState);

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
        } else if (data.type === 'payment' && data.payment) {
          console.log('Payment received:', data.payment);
          setPayments(prev => [...prev, data.payment!]);
        } else if (data.type === 'connected') {
          console.log('SSE connection established:', data.message);
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      if (eventSourceRef.current === eventSource) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        // Attempt to reconnect after a delay
        setTimeout(() => {
          console.log('Attempting to reconnect SSE...');
          setupSSE();
        }, 5000);
      }
    };
  }, []);

  // Fetch texts on component mount
  useEffect(() => {
    console.log('App component mounted, fetching texts...');
    fetchTexts();
  }, [fetchTexts]);

  // Set up SSE connection separately to handle StrictMode properly
  useEffect(() => {
    console.log('Setting up SSE...');
    setupSSE();

    // Cleanup function
    return () => {
      console.log('App component unmounting, cleaning up SSE...');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [setupSSE]);

  // Refresh texts periodically to check for completed images
  useEffect(() => {
    const interval = setInterval(() => {
      // Only refresh if there are pending or processing items
      const hasProcessingItems = texts.some(text => 
        text.status === 'pending' || text.status === 'processing'
      );
      
      if (hasProcessingItems) {
        console.log('Refreshing texts to check for completed images...');
        fetchTexts();
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [texts, fetchTexts]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!inputText.trim()) {
      setError('Please enter some text');
      return;
    }

    if (!connectionString.trim()) {
      setError('Please provide a valid ATXP connection string');
      setShowConnectionPrompt(true);
      return;
    }

    try {
      setLoading(true);
      setError('');
      setStageHistory([]); // Clear previous stage history
      setCurrentStage(null); // Clear any previous current stage
      setPayments([]); // Clear previous payments

      const response = await axios.post<Text>('/api/texts', 
        { text: inputText },
        { 
          headers: { 'x-atxp-connection-string': connectionString }
        }
      );
      setTexts(prevTexts => [...prevTexts, response.data]);
      setInputText('');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to submit text';
      setError(errorMessage);
      console.error('Error submitting text:', err);
      
      // If error is related to connection string, show the prompt
      if (err.response?.status === 400 && errorMessage.includes('connection string')) {
        setShowConnectionPrompt(true);
      }
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

  const togglePayments = () => {
    setIsPaymentsOpen(!isPaymentsOpen);
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="logo-container">
            <img 
              src="/logo_with_tagline.png" 
              alt="ATXP - Agent Transaction Protocol" 
              className="logo-image"
            />
          </div>
          <div className="header-subtitle">
            <p>Use an ATXP agent to create an image from text and share it with the world.</p>
          </div>
        </div>
        
        {/* Connection String Status */}
        {connectionString && !showConnectionPrompt && (
          <div className="connection-status">
            <span className="connection-indicator">✅ Connected</span>
            <button 
              className="clear-connection-button"
              onClick={clearConnectionString}
            >
              Clear Connection
            </button>
          </div>
        )}
      </header>

      <main className="App-main">
        {/* Connection Setup Screen */}
        {showConnectionPrompt && (
          <div className="connection-setup-layout">
            <div className="connection-setup-main">
              <h2>Welcome to the ATXP Agent Demo!</h2>
              <p>
                To get started with this demo, you'll need an ATXP connection string. 
                This allows the app to securely access ATXP services and generate images from your text.
              </p>
              
              <div className="connection-guide">
                <h3>How to get your connection string:</h3>
                <ol>
                  <li>
                    Go to <a 
                      href="https://accounts.atxp.ai" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="connection-link"
                    >
                      https://accounts.atxp.ai
                    </a>
                  </li>
                  <li>Log in to your ATXP account (or create one if you don't have one yet)</li>
                  <li>Find and copy your account connection string</li>
                  <li>Paste it in the field below</li>
                </ol>
              </div>
              
              <div className="connection-form">
                <label htmlFor="connection-input">Your ATXP Connection String:</label>
                <input
                  id="connection-input"
                  type="text"
                  value={connectionStringInput}
                  onChange={(e) => setConnectionStringInput(e.target.value)}
                  placeholder="https://accounts.atxp.ai/connection-string/..."
                  className="connection-input"
                  disabled={connectionValidating}
                />
                <small className="input-help">
                  This should be a URL starting with https://accounts.atxp.ai/
                </small>
                
                {connectionError && (
                  <div className="connection-error">{connectionError}</div>
                )}
                
                <div className="connection-buttons">
                  <button
                    onClick={saveConnectionString}
                    disabled={!connectionStringInput.trim() || connectionValidating}
                    className="save-connection-button"
                  >
                    {connectionValidating ? 'Validating...' : 'Connect & Start Demo'}
                  </button>
                  
                  {connectionString && (
                    <button
                      onClick={() => setShowConnectionPrompt(false)}
                      className="cancel-connection-button"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="connection-sidebar">
              <div className="connection-help">
                <p><strong>Need help?</strong></p>
                <ul>
                  <li>🔗 Your connection string is a secure URL that identifies your ATXP account</li>
                  <li>🔒 It's stored locally in your browser and never shared with third parties</li>
                  <li>📧 Don't have an ATXP account? Contact support or create one at accounts.atxp.ai</li>
                  <li>⚡ This demo showcases ATXP's AI image generation capabilities</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Main App Content - only show when connected */}
        {!showConnectionPrompt && (
          <>
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

        {/* Payments Accordion */}
        {payments.length > 0 && (
          <div className="payments-accordion">
            <button
              className="accordion-header"
              onClick={togglePayments}
              aria-expanded={isPaymentsOpen}
            >
              <h3>💰 Payments Made ({payments.length})</h3>
              <span className="accordion-icon">
                {isPaymentsOpen ? '▼' : '▶'}
              </span>
            </button>
            <div className={`accordion-content ${isPaymentsOpen ? 'open' : ''}`}>
              <div className="payments-list">
                {payments.map((payment, index) => (
                  <div key={index} className="payment-item">
                    <div className="payment-header">
                      <span className="payment-icon">💳</span>
                      <span className="payment-service">{payment.resourceName}</span>
                      <span className="payment-amount">{payment.amount} {payment.currency.toUpperCase()}</span>
                    </div>
                    <div className="payment-details">
                      <p><strong>Service:</strong> {payment.resourceUrl}</p>
                      <p><strong>Network:</strong> {payment.network}</p>
                      <p><strong>Account:</strong> {payment.accountId}</p>
                      <p><strong>Provider:</strong> {payment.iss}</p>
                    </div>
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
                  
                  {/* Status indicator for async processing */}
                  {text.status && (
                    <div className="text-status">
                      Status: <span className={`status-${text.status}`}>
                        {text.status === 'pending' && '⏳ Pending'}
                        {text.status === 'processing' && '🔄 Processing'}
                        {text.status === 'completed' && '✅ Completed'}
                        {text.status === 'failed' && '❌ Failed'}
                      </span>
                    </div>
                  )}
                  
                  {text.imageUrl && (
                    <figure>
                      <img src={text.imageUrl} alt={text.text} className="text-image" />
                      <figcaption>{text.fileName}</figcaption>
                    </figure>
                  )}
                  
                  {/* Show processing message if no image yet */}
                  {!text.imageUrl && (text.status === 'pending' || text.status === 'processing') && (
                    <div className="image-placeholder">
                      <div className="processing-indicator">
                        <div className="loading-spinner"></div>
                        <p>Generating image...</p>
                      </div>
                    </div>
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
        </>
        )}
      </main>
    </div>
  );
}

export default App;
