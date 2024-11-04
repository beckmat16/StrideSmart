import React, { useState } from 'react';
import FormComponent from './FormComponent';

const AITrainingPlan = () => {
    const [output, setOutput] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (userInput) => {
        try {
            setLoading(true);
            setError(null);
            
            // Make request to the LLM API with the data
            const llmResponse = await fetch('/llm/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userInput), 
            });

            if (!llmResponse.ok) {
                throw new Error('Failed to get analysis');
            }

            const result = await llmResponse.json();
            setOutput(result);
        } catch (err) {
            setError('Failed to generate training plan. Please try again.');
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="training-plan-container">
            <h2>Generate AI Training Plan</h2>
            <FormComponent onSubmit={handleSubmit} />
            
            {loading && <div className="loading">Analyzing your training data...</div>}
            {error && <div className="error">{error}</div>}
            
            {output && (
                <div className="analysis-output">
                    <h3>Training Analysis</h3>
                    <div className="analysis-content">
                        {/* The analysis comes as a formatted string from the API */}
                        {output.analysis.split('\n').map((line, index) => (
                            <p key={index}>{line}</p>
                        ))}
                    </div>
                    <div className="metadata">
                        <p>Analysis based on {output.training_data_used} recent activities</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AITrainingPlan;

