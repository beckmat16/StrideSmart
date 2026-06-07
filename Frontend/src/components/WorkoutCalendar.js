import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Edit, Plus, Calendar, Clock, Zap } from 'lucide-react';

const WorkoutCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workouts, setWorkouts] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [hoveredDate, setHoveredDate] = useState(null);
  const [userProfile, setUserProfile] = useState({
    goalRace: 'Marathon',
    targetTime: '3:30:00',
    currentWeeklyMiles: 35,
    raceDate: '2024-10-15'
  });

  // Get the first day of the current month
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());

  const generateWorkoutForDate = async (date) => {
    const dateKey = date.toISOString().split('T')[0];
    setIsGenerating(true);
    
    // Get athlete_id from URL params (set when they log in via Strava)
    const urlParams = new URLSearchParams(window.location.search);
    const athleteId = urlParams.get('athlete_id');
    
    if (!athleteId) {
      console.error('No athlete_id found - user needs to authenticate with Strava');
      generateMockWorkout(date, dateKey);
      setIsGenerating(false);
      return;
    }
    
    try {
      // This will now call your REAL AI endpoint with REAL Strava data!
      const response = await fetch('http://127.0.0.1:8000/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `You are my running coach. Generate a specific workout for ${date.toDateString()} based on my recent Strava training data. 
                   
                   My current goals:
                   - Goal race: ${userProfile.goalRace} 
                   - Target time: ${userProfile.targetTime}
                   - Current weekly mileage: ${userProfile.currentWeeklyMiles} miles
                   - Race date: ${userProfile.raceDate}
                   
                   Please analyze my recent training pattern and suggest an appropriate workout for this day.
                   
                   Respond in this EXACT format:
                   TYPE|DESCRIPTION|HEART_RATE_ZONE|DURATION
                   
                   Examples:
                   - Easy Run|4 miles at conversational pace, focus on easy aerobic development|Zone 1-2|35 min
                   - Tempo Run|2 mile warm-up, 3 miles at comfortably hard pace, 1 mile cool-down|Zone 3-4|45 min
                   - Rest|Complete rest day or light stretching/yoga|Recovery|0-30 min`,
          athlete_id: parseInt(athleteId)
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('AI Response:', data);
        
        // Parse the AI response which should be in format: TYPE|DESCRIPTION|HEART_RATE_ZONE|DURATION
        const parts = data.reply.split('|');
        
        if (parts.length >= 4) {
          const generatedWorkout = {
            id: Date.now(),
            date: dateKey,
            type: parts[0].trim(),
            description: parts[1].trim(),
            heartRateZone: parts[2].trim(),
            duration: parts[3].trim(),
            status: 'suggested'
          };

          setWorkouts(prev => ({
            ...prev,
            [dateKey]: generatedWorkout
          }));
        } else {
          console.warn('AI response not in expected format, using fallback');
          generateMockWorkout(date, dateKey);
        }
      } else {
        console.error('AI API call failed:', response.statusText);
        // Fallback to mock data if API fails
        generateMockWorkout(date, dateKey);
      }
    } catch (error) {
      console.error('Error generating workout:', error);
      // Fallback to mock data
      generateMockWorkout(date, dateKey);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateMockWorkout = (date, dateKey) => {
    const dayOfWeek = date.getDay();
    const weekOfMonth = Math.ceil(date.getDate() / 7);
    
    const workoutTypes = {
      0: { 
        type: 'Rest', 
        description: 'Complete rest day or light stretching/yoga',
        zone: 'Recovery',
        duration: '0-30 min'
      },
      1: { 
        type: 'Easy Run', 
        description: `${3 + weekOfMonth} miles at conversational pace`,
        zone: 'Zone 1-2',
        duration: `${25 + weekOfMonth * 8} min`
      },
      2: { 
        type: 'Tempo Run', 
        description: `1 mile warm-up, ${2 + weekOfMonth} miles at comfortably hard pace, 1 mile cool-down`,
        zone: 'Zone 3-4',
        duration: `${35 + weekOfMonth * 5} min`
      },
      3: { 
        type: 'Easy Run', 
        description: `${4 + weekOfMonth} miles at easy pace`,
        zone: 'Zone 2',
        duration: `${30 + weekOfMonth * 8} min`
      },
      4: { 
        type: 'Speed Work', 
        description: `1 mile warm-up, 6 x 400m at 5K pace with 200m recovery jog, 1 mile cool-down`,
        zone: 'Zone 4-5',
        duration: `${40 + weekOfMonth * 3} min`
      },
      5: { 
        type: 'Recovery Run', 
        description: `${3 + Math.floor(weekOfMonth/2)} miles at very easy pace`,
        zone: 'Zone 1',
        duration: `${25 + weekOfMonth * 5} min`
      },
      6: { 
        type: 'Long Run', 
        description: `${8 + weekOfMonth * 2} miles at steady aerobic pace`,
        zone: 'Zone 2',
        duration: `${65 + weekOfMonth * 15} min`
      }
    };

    const workout = workoutTypes[dayOfWeek];
    
    const generatedWorkout = {
      id: Date.now(),
      date: dateKey,
      type: workout.type,
      description: workout.description,
      heartRateZone: workout.zone,
      duration: workout.duration,
      status: 'suggested'
    };

    setWorkouts(prev => ({
      ...prev,
      [dateKey]: generatedWorkout
    }));
  };

  const generateWeekWorkouts = async () => {
    const today = new Date();
    setIsGenerating(true);
    
    const promises = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      promises.push(generateWorkoutForDate(date));
    }
    
    await Promise.all(promises);
    setIsGenerating(false);
  };

  const acceptWorkout = (dateKey) => {
    setWorkouts(prev => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        status: 'accepted'
      }
    }));
  };

  const rejectWorkout = (dateKey) => {
    setWorkouts(prev => {
      const newWorkouts = { ...prev };
      delete newWorkouts[dateKey];
      return newWorkouts;
    });
  };

  const startEdit = (dateKey) => {
    setEditingWorkout(dateKey);
  };

  const saveEdit = (dateKey, newDescription) => {
    setWorkouts(prev => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        description: newDescription,
        status: 'modified'
      }
    }));
    setEditingWorkout(null);
  };

  const getDaysInMonth = () => {
    const days = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const getWorkoutForDate = (date) => {
    const dateKey = date.toISOString().split('T')[0];
    return workouts[dateKey];
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const getIntensityIcon = (type) => {
    switch (type) {
      case 'Speed Work':
      case 'Intervals':
        return <Zap size={12} className="intensity-icon speed" />;
      case 'Tempo Run':
        return <Zap size={12} className="intensity-icon tempo" />;
      case 'Long Run':
        return <Clock size={12} className="intensity-icon long" />;
      default:
        return null;
    }
  };

  const WorkoutCard = ({ workout, dateKey }) => {
    const [editText, setEditText] = useState(workout.description);
    const isEditing = editingWorkout === dateKey;

    return (
      <div className={`workout-card ${workout.status}`}>
        <div className="workout-header">
          <div className="workout-type">
            {getIntensityIcon(workout.type)}
            <span className="type-text">{workout.type}</span>
          </div>
          <div className="workout-actions">
            {workout.status === 'suggested' && (
              <>
                <button
                  onClick={() => acceptWorkout(dateKey)}
                  className="action-btn accept"
                  title="Accept workout"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => startEdit(dateKey)}
                  className="action-btn edit"
                  title="Edit workout"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => rejectWorkout(dateKey)}
                  className="action-btn reject"
                  title="Reject workout"
                >
                  <X size={14} />
                </button>
              </>
            )}
            {(workout.status === 'accepted' || workout.status === 'modified') && (
              <button
                onClick={() => startEdit(dateKey)}
                className="action-btn edit"
                title="Edit workout"
              >
                <Edit size={14} />
              </button>
            )}
          </div>
        </div>
        
        {isEditing ? (
          <div className="edit-form">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="edit-textarea"
              rows="3"
              placeholder="Describe your workout..."
            />
            <div className="edit-buttons">
              <button
                onClick={() => saveEdit(dateKey, editText)}
                className="save-btn"
              >
                Save
              </button>
              <button
                onClick={() => setEditingWorkout(null)}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="workout-content">
            <p className="workout-description">{workout.description}</p>
            <div className="workout-details">
              <span className="heart-rate">{workout.heartRateZone}</span>
              <span className="duration">
                <Clock size={12} />
                {workout.duration}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="workout-calendar-container">
      <div className="calendar-wrapper">
        <div className="calendar-header">
          <h1 className="calendar-title">
            <Calendar size={32} />
            Workout Calendar
          </h1>
          <div className="header-actions">
            <button
              onClick={generateWeekWorkouts}
              disabled={isGenerating}
              className="generate-btn"
            >
              <Plus size={18} />
              {isGenerating ? 'Generating...' : 'Generate This Week'}
            </button>
          </div>
        </div>

        <div className="month-navigation">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
            className="nav-btn"
          >
            <ChevronLeft size={24} />
          </button>
          <h2 className="month-title">
            {formatDate(currentDate)}
          </h2>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
            className="nav-btn"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="weekday-headers">
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
            <div key={day} className="weekday-header">
              {day}
            </div>
          ))}
        </div>

        <div className="calendar-grid">
          {getDaysInMonth().map((date, index) => {
            const dateKey = date.toISOString().split('T')[0];
            const workout = getWorkoutForDate(date);
            const isCurrentMonthDate = isCurrentMonth(date);
            const isTodayDate = isToday(date);

            return (
              <div
                key={index}
                className={`calendar-day ${isCurrentMonthDate ? 'current-month' : 'other-month'} ${isTodayDate ? 'today' : ''}`}
                onMouseEnter={() => setHoveredDate(dateKey)}
                onMouseLeave={() => setHoveredDate(null)}
              >
                <div className="day-header">
                  <span className="day-number">
                    {date.getDate()}
                  </span>
                  {!workout && hoveredDate === dateKey && isCurrentMonthDate && (
                    <button
                      onClick={() => generateWorkoutForDate(date)}
                      className="add-workout-btn"
                      title="Generate workout for this day"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>
                
                {workout && (
                  <WorkoutCard workout={workout} dateKey={dateKey} />
                )}
              </div>
            );
          })}
        </div>

        <div className="status-legend">
          <h3 className="legend-title">Workout Status:</h3>
          <div className="legend-items">
            <div className="legend-item">
              <div className="status-indicator suggested"></div>
              <span>AI Suggested</span>
            </div>
            <div className="legend-item">
              <div className="status-indicator accepted"></div>
              <span>Accepted</span>
            </div>
            <div className="legend-item">
              <div className="status-indicator modified"></div>
              <span>Modified</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkoutCalendar;