import React, { useState } from 'react';
import FormComponent from './formcomponent';

const AITrainingPlan = () => {
    const [output, setOutput] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (userInput) => {
        try {
            setLoading(true);
            setError(null);
            
            console.log('Submitting data:', userInput); // Debug log
            
            // Dynamic API URL for local and Heroku deployment
            const API_BASE_URL = process.env.NODE_ENV === 'production' 
                ? process.env.REACT_APP_API_URL || window.location.origin
                : 'http://localhost:8000';
            
            // Make request to the LLM API with the data
            const llmResponse = await fetch(`${API_BASE_URL}/llm/analyze`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(userInput), 
            });

            console.log('Response status:', llmResponse.status); // Debug log

            if (!llmResponse.ok) {
                // Get the actual error message from the backend
                const errorData = await llmResponse.json().catch(() => ({}));
                console.error('Backend error:', errorData); // Debug log
                
                throw new Error(errorData.detail || `HTTP ${llmResponse.status}: ${llmResponse.statusText}`);
            }

            const result = await llmResponse.json();
            console.log('Success result:', result); // Debug log
            
            setOutput(result);
        } catch (err) {
            console.error('Full error:', err); // Debug log
            
            // More specific error messages
            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                setError('Unable to connect to the server. Please check if the backend is running.');
            } else if (err.message.includes('OpenAI API key')) {
                setError('API configuration issue. Please contact support.');
            } else if (err.message.includes('rate_limit')) {
                setError('API rate limit exceeded. Please try again in a few minutes.');
            } else if (err.message.includes('insufficient_quota')) {
                setError('API quota exceeded. Please contact support.');
            } else {
                setError(`Failed to generate training plan: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const formatAnalysis = (analysisText) => {
        // Split by double newlines to create paragraphs
        const paragraphs = analysisText.split('\n\n').filter(p => p.trim());
        
        return paragraphs.map((paragraph, index) => {
            // Check if this is a numbered list item or header
            if (paragraph.match(/^\d+\./)) {
                return (
                    <div key={index} className="analysis-section">
                        <h4>{paragraph.split('\n')[0]}</h4>
                        {paragraph.split('\n').slice(1).map((line, lineIndex) => (
                            <p key={lineIndex}>{line}</p>
                        ))}
                    </div>
                );
            } else {
                return (
                    <div key={index} className="analysis-paragraph">
                        {paragraph.split('\n').map((line, lineIndex) => (
                            <p key={lineIndex}>{line}</p>
                        ))}
                    </div>
                );
            }
        });
    };

    return (
        <div className="training-plan-container">
            <h2>Weekly Rundown</h2>
            <FormComponent onSubmit={handleSubmit} />
            
            {loading && (
                <div className="loading">
                    <div className="loading-spinner"></div>
                    <p>Analyzing your training data...</p>
                </div>
            )}
            
            {error && (
                <div className="error">
                    <h4>Error</h4>
                    <p>{error}</p>
                    <button onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}
            
            {output && (
                <div className="analysis-output">
                    <h3>Training Analysis</h3>
                    
                    {output.status === 'no_data' ? (
                        <div className="no-data-message">
                            <p>{output.analysis}</p>
                            <p>Make sure you have connected your Strava account and have recent activities.</p>
                        </div>
                    ) : (
                        <div className="analysis-content">
                            {formatAnalysis(output.analysis)}
                        </div>
                    )}
                    
                    <div className="metadata">
                        <p>Analysis based on {output.training_data_used} recent activities</p>
                        <p>Status: {output.status}</p>
                    </div>
                </div>
            )}
            
            <style jsx>{`
                .training-plan-container {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                
                .loading {
                    text-align: center;
                    padding: 20px;
                    background: #f0f8ff;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                
                .loading-spinner {
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3498db;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 2s linear infinite;
                    margin: 0 auto 10px;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .error {
                    background: #ffebee;
                    border: 1px solid #f44336;
                    color: #c62828;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                
                .error h4 {
                    margin: 0 0 10px 0;
                    color: #c62828;
                }
                
                .error button {
                    background: #f44336;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-top: 10px;
                }
                
                .analysis-output {
                    background: #f9f9f9;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                }
                
                .analysis-content {
                    line-height: 1.6;
                    margin-bottom: 20px;
                }
                
                .analysis-section {
                    margin-bottom: 20px;
                }
                
                .analysis-section h4 {
                    color: #2c3e50;
                    margin-bottom: 10px;
                    font-weight: bold;
                }
                
                .analysis-paragraph {
                    margin-bottom: 15px;
                }
                
                .no-data-message {
                    text-align: center;
                    padding: 20px;
                    background: #fff3cd;
                    border: 1px solid #ffeaa7;
                    border-radius: 8px;
                    color: #856404;
                }
                
                .metadata {
                    border-top: 1px solid #ddd;
                    padding-top: 15px;
                    color: #666;
                    font-size: 0.9em;
                }
            `}</style>
        </div>
    );
};

export default AITrainingPlan;