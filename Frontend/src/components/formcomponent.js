import React, { useState } from 'react';

const FormComponent = ({ onSubmit }) => {
  const [raceDate, setRaceDate] = useState('');
  const [desiredTime, setDesiredTime] = useState('');
  const [errors, setErrors] = useState({});

  const validateTime = (time) => {
    const timeRegex = /^([0-9]{2}):([0-9]{2}):([0-9]{2})$/;
    return timeRegex.test(time);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    // Validate race date
    if (!raceDate) {
      newErrors.raceDate = 'Race date is required';
    } else if (new Date(raceDate) < new Date()) {
      newErrors.raceDate = 'Race date must be in the future';
    }

    // Validate desired time
    if (!desiredTime) {
      newErrors.desiredTime = 'Desired time is required';
    } else if (!validateTime(desiredTime)) {
      newErrors.desiredTime = 'Please enter time in HH:MM:SS format';
    }

    if (Object.keys(newErrors).length === 0) {
      onSubmit({ raceDate, desiredTime });
    } else {
      setErrors(newErrors);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="training-form">
      <div className="form-group">
        <label htmlFor="raceDate">Race Date:</label>
        <input
          id="raceDate"
          type="date"
          value={raceDate}
          onChange={(e) => {
            setRaceDate(e.target.value);
            setErrors({...errors, raceDate: ''});
          }}
          min={new Date().toISOString().split('T')[0]}
        />
        {errors.raceDate && <span className="error">{errors.raceDate}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="desiredTime">Desired Time (HH:MM:SS):</label>
        <input
          id="desiredTime"
          type="text"
          value={desiredTime}
          placeholder="03:30:00"
          onChange={(e) => {
            setDesiredTime(e.target.value);
            setErrors({...errors, desiredTime: ''});
          }}
        />
        {errors.desiredTime && <span className="error">{errors.desiredTime}</span>}
      </div>

      <button type="submit" className="submit-button">Generate Plan</button>
    </form>
  );
};

export default FormComponent;
