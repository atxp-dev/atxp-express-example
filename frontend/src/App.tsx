import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import axios from 'axios';
import './App.css';

// Define the Text interface to match the backend
interface Text {
  id: number;
  text: string;
  timestamp: string;
  imageUrl: string;
  fileId: string;
}

function App(): JSX.Element {
  const [texts, setTexts] = useState<Text[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Fetch texts on component mount
  useEffect(() => {
    fetchTexts();
  }, []);

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
      const response = await axios.post<Text>('/api/texts', { text: inputText });
      setTexts(prevTexts => [...prevTexts, response.data]);
      setInputText('');
      setError('');
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
                    <img src={text.imageUrl} alt="Generated from text" className="text-image" />
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
