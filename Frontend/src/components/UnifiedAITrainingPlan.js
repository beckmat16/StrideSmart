import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Edit, Plus, Calendar, Clock, Zap, Target, Play } from 'lucide-react';

const UnifiedAITrainingPlan = ({ athleteId }) => {
  // Goal setting state
  const [goalSettings, setGoalSettings] = useState({
    raceDate: '',
    desiredTime: '',
    raceType: 'Marathon',
    planDays: 7,
  });
  const [generationProgress, setGenerationProgress] = useState(null);
  const [hasSetGoals, setHasSetGoals] = useState(false);
  const [trainingAnalysis, setTrainingAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [errors, setErrors] = useState({});

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workouts, setWorkouts] = useState({});
  const [completedWorkouts, setCompletedWorkouts] = useState({}); // NEW: Track completed workouts
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [hoveredDate, setHoveredDate] = useState(null);

  // NEW: Load saved data on component mount and when athleteId changes
  useEffect(() => {
    if (athleteId) {
      loadSavedData();
    }
  }, [athleteId]);

  // NEW: Load saved training plan and completed workouts
  const loadSavedData = () => {
    try {
      // Load goals
      const savedGoals = localStorage.getItem(`goals_${athleteId}`);
      if (savedGoals) {
        const goals = JSON.parse(savedGoals);
        setGoalSettings({
          raceDate: goals.raceDate || '',
          desiredTime: goals.desiredTime || '',
          raceType: goals.raceType || 'Marathon',
          planDays: goals.planDays ? Number(goals.planDays) : 7,
        });
        setHasSetGoals(true);
      }

      // Load training analysis
      const savedAnalysis = localStorage.getItem(`analysis_${athleteId}`);
      if (savedAnalysis) {
        setTrainingAnalysis(JSON.parse(savedAnalysis));
      }

      // Load full training plan workouts (all days)
      const savedPlan = localStorage.getItem(`workouts_plan_${athleteId}`);
      if (savedPlan) {
        setWorkouts(JSON.parse(savedPlan));
      } else {
        const weekKey = getWeekKey(new Date());
        const savedWorkouts = localStorage.getItem(`workouts_${athleteId}_${weekKey}`);
        if (savedWorkouts) {
          setWorkouts(JSON.parse(savedWorkouts));
        }
      }

      // Load completed workouts
      const savedCompleted = localStorage.getItem(`completed_${athleteId}`);
      if (savedCompleted) {
        setCompletedWorkouts(JSON.parse(savedCompleted));
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  };

  // NEW: Get week key for storage
  const getWeekKey = (date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    return startOfWeek.toISOString().split('T')[0];
  };

  // NEW: Save data to localStorage
  const saveData = (type, data) => {
    try {
      switch (type) {
        case 'goals':
          localStorage.setItem(`goals_${athleteId}`, JSON.stringify(data));
          break;
        case 'analysis':
          localStorage.setItem(`analysis_${athleteId}`, JSON.stringify(data));
          break;
        case 'workouts':
          localStorage.setItem(`workouts_plan_${athleteId}`, JSON.stringify(data));
          break;
        case 'completed':
          localStorage.setItem(`completed_${athleteId}`, JSON.stringify(data));
          break;
      }
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  // Add pace calculation helper function
  const calculateTargetPace = (timeString, raceType) => {
    if (!timeString || !validateTime(timeString)) {
      return null;
    }
    const [hours, minutes, seconds] = timeString.split(':').map(Number);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    if (!totalSeconds || totalSeconds <= 0) {
      return null;
    }
    
    // Distance in miles for each race type
    const distances = {
      'Marathon': 26.2,
      'Half Marathon': 13.1,
      '10K': 6.2,
      '5K': 3.1
    };
    
    const distance = distances[raceType];
    const pacePerMileSeconds = totalSeconds / distance;
    
    const paceMinutes = Math.floor(pacePerMileSeconds / 60);
    const paceSeconds = Math.round(pacePerMileSeconds % 60);
    const pacePerMile = `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}`;
    
    // Calculate training paces (rough estimates)
    const easyPaceSeconds = pacePerMileSeconds + 60; // Add 1 minute for easy pace
    const tempoPaceSeconds = pacePerMileSeconds - 20; // Subtract 20 seconds for tempo
    const thresholdPaceSeconds = pacePerMileSeconds - 30; // Subtract 30 seconds for threshold
    
    const formatPace = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    return {
      pacePerMile,
      easyPace: formatPace(easyPaceSeconds),
      tempoPace: formatPace(tempoPaceSeconds),
      thresholdPace: formatPace(thresholdPaceSeconds)
    };
  };

  const validateTime = (time) => {
    const timeRegex = /^([0-9]{1,2}):([0-9]{2}):([0-9]{2})$/;
    return timeRegex.test(time);
  };

  const handleGoalSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    // Validate race date
    if (!goalSettings.raceDate) {
      newErrors.raceDate = 'Race date is required';
    } else if (new Date(goalSettings.raceDate) < new Date()) {
      newErrors.raceDate = 'Race date must be in the future';
    }

    // Validate desired time
    if (!goalSettings.desiredTime) {
      newErrors.desiredTime = 'Desired time is required';
    } else if (!validateTime(goalSettings.desiredTime)) {
      newErrors.desiredTime = 'Please enter time in HH:MM:SS format';
    }

    const planDays = Number(goalSettings.planDays);
    if (!planDays || planDays < 1 || planDays > 140) {
      newErrors.planDays = 'Enter plan length between 1 and 140 days';
    }

    if (Object.keys(newErrors).length === 0) {
      setErrors({});
      setLoadingAnalysis(true);
      setAnalysisError(null);
      
      try {
        // Get training analysis
        const analysisResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/llm/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...goalSettings, athlete_id: athleteId })
        });

        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          setTrainingAnalysis(analysisData);
          setHasSetGoals(true);
          
          // Save goals and analysis
          saveData('goals', goalSettings);
          saveData('analysis', analysisData);
          
          const days = Math.min(140, Math.max(1, Number(goalSettings.planDays) || 7));
          await generatePlanWorkouts(days);
        } else {
          const errorData = await analysisResponse.json();
          setAnalysisError(errorData.detail || 'Failed to analyze training data');
        }
      } catch (error) {
        setAnalysisError('Unable to connect to the server. Please try again.');
      } finally {
        setLoadingAnalysis(false);
      }
    } else {
      setErrors(newErrors);
    }
  };

  const parseWorkoutReply = (reply) => {
    if (!reply || typeof reply !== 'string') return null;

    const lines = reply.split('\n').map((line) => line.trim()).filter(Boolean);
    const candidates = [...lines, reply.replace(/\n/g, ' ').trim()];

    for (const line of candidates) {
      const pipeIndex = line.indexOf('|');
      if (pipeIndex === -1) continue;

      const parts = line.split('|').map((part) => part.trim().replace(/^\*+|\*+$/g, ''));
      if (parts.length >= 4 && parts[0] && parts[1]) {
        return {
          type: parts[0],
          description: parts[1],
          heartRateZone: parts[2] || 'Zone 2',
          duration: parts[3] || '45 min',
        };
      }
    }
    return null;
  };

  // Generate unique workout for each date via AI (falls back to template if parse fails)
  const generateWorkoutForDate = async (date, existingWorkouts = {}) => {
    const dateKey = date.toISOString().split('T')[0];
    
    try {
      const targetPaceInfo = calculateTargetPace(goalSettings.desiredTime, goalSettings.raceType);
      if (!targetPaceInfo) {
        return generateMockWorkout(date, dateKey, []);
      }

      // Get day of week for context
      const dayOfWeek = date.getDay();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[dayOfWeek];
      
      // FIXED: Get existing workouts in current week to ensure variety
      const weekWorkouts = Object.values(existingWorkouts)
        .filter(w => {
          const workoutDate = new Date(w.date);
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          return workoutDate >= weekStart && workoutDate <= weekEnd;
        })
        .map(w => w.type);

      // FIXED: More specific prompt with explicit pace units
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/llm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `You are my running coach. Generate a UNIQUE workout for ${dayName}, ${date.toDateString()}.
                   
                   CRITICAL: Use MILES and MINUTES:SECONDS per MILE format for ALL paces (e.g., 7:30 per mile, NOT 4:39 per km).
                   
                   My goals:
                   - Goal race: ${goalSettings.raceType} 
                   - Target time: ${goalSettings.desiredTime}
                   - Target pace: ${targetPaceInfo.pacePerMile} per mile
                   - Race date: ${goalSettings.raceDate}
                   
                   Training zones (ALL in minutes:seconds per MILE):
                   - Easy runs: ${targetPaceInfo.easyPace} per mile
                   - Tempo runs: ${targetPaceInfo.tempoPace} per mile  
                   - Threshold: ${targetPaceInfo.thresholdPace} per mile
                   
                   AVOID these workout types already planned this week: ${weekWorkouts.join(', ') || 'None yet'}
                   
                   Day-specific guidance:
                   - Sunday: Long run or rest
                   - Monday: Easy recovery or rest  
                   - Tuesday: Speed/interval work
                   - Wednesday: Easy run or cross-training
                   - Thursday: Tempo or threshold run
                   - Friday: Easy run or rest
                   - Saturday: Medium long run or race pace work
                   
                   Respond with ONE line only in this exact format (no markdown, no extra text):
                   TYPE|DESCRIPTION|HEART_RATE_ZONE|DURATION
                   
                   Example: Tempo Run|2 mile warm-up at ${targetPaceInfo.easyPace} per mile, 3 miles at ${targetPaceInfo.tempoPace} per mile, 1 mile cool-down|Zone 3-4|45 min`,
          athlete_id: athleteId
        })
      });

      if (response.ok) {
        const data = await response.json();
        const parsed = parseWorkoutReply(data.reply);

        if (parsed) {
          return {
            id: `${athleteId}_${dateKey}_${Date.now()}`,
            date: dateKey,
            type: parsed.type,
            description: parsed.description,
            heartRateZone: parsed.heartRateZone,
            duration: parsed.duration,
            status: 'suggested',
            source: 'ai',
          };
        }
        console.warn('AI reply not in expected format, using template:', data.reply?.slice(0, 120));
        return generateMockWorkout(date, dateKey, weekWorkouts);
      } else {
        return generateMockWorkout(date, dateKey, weekWorkouts);
      }
    } catch (error) {
      console.error('Error generating workout:', error);
      return generateMockWorkout(date, dateKey, weekWorkouts);
    }
  };

  // FIXED: Generate mock workout with variety
  const generateMockWorkout = (date, dateKey, existingTypes = []) => {
    const dayOfWeek = date.getDay();
    const targetPaceInfo = calculateTargetPace(goalSettings.desiredTime, goalSettings.raceType);
    if (!targetPaceInfo) {
      return {
        id: `${athleteId}_${dateKey}_${Date.now()}`,
        date: dateKey,
        type: 'Easy Run',
        description: 'Easy aerobic run — set a valid goal time for personalized paces.',
        heartRateZone: 'Zone 2',
        duration: '40 min',
        status: 'suggested',
      };
    }

    // Different workout types for each day, avoiding duplicates
    const workoutsByDay = {
      0: [ // Sunday
        { type: 'Long Run', description: `10-14 miles at ${targetPaceInfo.easyPace} per mile with last 2 miles at moderate effort`, zone: 'Zone 2-3', duration: '75-100 min' },
        { type: 'Rest', description: 'Complete rest day or light stretching/yoga', zone: 'Recovery', duration: '0-30 min' }
      ],
      1: [ // Monday  
        { type: 'Recovery Run', description: `3-4 miles at ${targetPaceInfo.easyPace} per mile, very easy pace`, zone: 'Zone 1', duration: '25-35 min' },
        { type: 'Rest', description: 'Complete rest day or light yoga', zone: 'Recovery', duration: '0-30 min' }
      ],
      2: [ // Tuesday
        { type: 'Speed Work', description: `1 mile warm-up, 6 x 800m at ${targetPaceInfo.thresholdPace} per mile with 400m recovery, 1 mile cool-down`, zone: 'Zone 4-5', duration: '50 min' },
        { type: 'Interval Training', description: `2 mile warm-up, 5 x 1000m at ${targetPaceInfo.tempoPace} per mile with 2 min recovery, 1 mile cool-down`, zone: 'Zone 4', duration: '55 min' }
      ],
      3: [ // Wednesday
        { type: 'Easy Run', description: `5-6 miles at ${targetPaceInfo.easyPace} per mile, conversational pace`, zone: 'Zone 2', duration: '40-50 min' },
        { type: 'Cross Training', description: 'Cycling, swimming, or elliptical at moderate effort', zone: 'Zone 2-3', duration: '45-60 min' }
      ],
      4: [ // Thursday
        { type: 'Tempo Run', description: `2 mile warm-up at ${targetPaceInfo.easyPace} per mile, 4 miles at ${targetPaceInfo.tempoPace} per mile, 1 mile cool-down`, zone: 'Zone 3-4', duration: '50 min' },
        { type: 'Threshold Run', description: `1.5 mile warm-up, 3 x 1 mile at ${targetPaceInfo.thresholdPace} per mile with 90 sec recovery, 1.5 mile cool-down`, zone: 'Zone 4', duration: '45 min' }
      ],
      5: [ // Friday
        { type: 'Easy Run', description: `4-5 miles at ${targetPaceInfo.easyPace} per mile, easy effort`, zone: 'Zone 1-2', duration: '35-40 min' },
        { type: 'Rest', description: 'Complete rest day before weekend long run', zone: 'Recovery', duration: '0-20 min' }
      ],
      6: [ // Saturday
        { type: 'Race Pace Run', description: `2 mile warm-up, 5 miles at ${targetPaceInfo.pacePerMile} per mile (goal race pace), 1 mile cool-down`, zone: 'Zone 3', duration: '55 min' },
        { type: 'Medium Long Run', description: `8-10 miles at ${targetPaceInfo.easyPace} per mile with 3 miles at moderate effort`, zone: 'Zone 2-3', duration: '65-80 min' }
      ]
    };

    const dayWorkouts = workoutsByDay[dayOfWeek];
    // Choose workout that hasn't been used this week
    let selectedWorkout = dayWorkouts[0];
    for (const workout of dayWorkouts) {
        if (!existingTypes.includes(workout.type)) {  
        selectedWorkout = workout;
        break;
      }
    }
    
    return {
      id: `${athleteId}_${dateKey}_${Date.now()}`,
      date: dateKey,
      type: selectedWorkout.type,
      description: selectedWorkout.description,
      heartRateZone: selectedWorkout.zone,
      duration: selectedWorkout.duration,
      status: 'suggested'
    };
  };

  const generatePlanWorkouts = async (numDays) => {
    const totalDays = Math.min(140, Math.max(1, Number(numDays) || 7));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    setIsGenerating(true);
    setGenerationProgress({ current: 0, total: totalDays });

    const newWorkouts = { ...workouts };

    for (let i = 0; i < totalDays; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];

      const workout = await generateWorkoutForDate(date, newWorkouts);
      newWorkouts[dateKey] = workout;

      setWorkouts({ ...newWorkouts });
      setGenerationProgress({ current: i + 1, total: totalDays });

      if (i < totalDays - 1) {
        await new Promise((resolve) => setTimeout(resolve, totalDays > 21 ? 150 : 300));
      }
    }

    saveData('workouts', newWorkouts);
    setIsGenerating(false);
    setGenerationProgress(null);
  };

  // NEW: Log completed workout
  const logCompletedWorkout = (dateKey, actualDistance, actualPace) => {
    const plannedWorkout = workouts[dateKey];
    if (!plannedWorkout) return;

    const completedWorkout = {
      date: new Date().toISOString().split('T')[0],
      actualDistance,
      actualPace,
      plannedWorkout: plannedWorkout,
      completedAt: new Date().toISOString()
    };

    const newCompleted = {
      ...completedWorkouts,
      [dateKey]: completedWorkout
    };

    setCompletedWorkouts(newCompleted);
    saveData('completed', newCompleted);

    // Update workout status
    const updatedWorkouts = {
      ...workouts,
      [dateKey]: { ...workouts[dateKey], status: 'completed' }
    };
    setWorkouts(updatedWorkouts);
    saveData('workouts', updatedWorkouts);
  };

  // Calendar helper functions
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const startDate = new Date(firstDayOfMonth);
  startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());

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

  const getCompletedWorkoutForDate = (date) => {
    const dateKey = date.toISOString().split('T')[0];
    return completedWorkouts[dateKey];
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const formatAnalysis = (analysisText) => {
    if (!analysisText) {
      return <p className="analysis-paragraph">No analysis text available.</p>;
    }

    const sections = analysisText.split(/(?=\d+\.\s)/).filter((s) => s.trim());

    if (sections.length <= 1 && !analysisText.match(/^\d+\./)) {
      return (
        <div className="analysis-paragraph">
          {analysisText.split('\n').filter((line) => line.trim()).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      );
    }

    return sections.map((section, index) => {
      const lines = section.trim().split('\n').filter((line) => line.trim());
      const title = lines[0];
      const body = lines.slice(1);

      if (title.match(/^\d+\./)) {
        return (
          <div key={index} className="analysis-section">
            <h4 className="analysis-section-title">{title}</h4>
            {body.map((line, lineIndex) => (
              <p key={lineIndex}>{line}</p>
            ))}
          </div>
        );
      }

      return (
        <div key={index} className="analysis-paragraph">
          {lines.map((line, lineIndex) => (
            <p key={lineIndex}>{line}</p>
          ))}
        </div>
      );
    });
  };

  const renderGoalBreakdown = () => {
    const paceInfo = calculateTargetPace(goalSettings.desiredTime, goalSettings.raceType);
    if (!paceInfo) {
      return (
        <p className="goal-breakdown-hint">
          Enter a valid goal time (HH:MM:SS) to see your pace breakdown.
        </p>
      );
    }

    return (
      <div className="pace-zones">
        <div className="pace-zone">
          <strong>Race:</strong> {goalSettings.raceType} on{' '}
          {goalSettings.raceDate
            ? new Date(goalSettings.raceDate + 'T12:00:00').toLocaleDateString()
            : '—'}
        </div>
        <div className="pace-zone">
          <strong>Goal Time:</strong> {goalSettings.desiredTime}
        </div>
        <div className="pace-zone">
          <strong>Goal Pace:</strong> {paceInfo.pacePerMile} per mile
        </div>
        <div className="pace-zone">
          <strong>Easy Runs:</strong> {paceInfo.easyPace} per mile
        </div>
        <div className="pace-zone">
          <strong>Tempo Runs:</strong> {paceInfo.tempoPace} per mile
        </div>
        <div className="pace-zone">
          <strong>Threshold:</strong> {paceInfo.thresholdPace} per mile
        </div>
      </div>
    );
  };

  const getIntensityIcon = (type) => {
    switch (type) {
      case 'Speed Work':
      case 'Intervals':
      case 'Interval Training':
        return <Zap size={12} className="intensity-icon speed" />;
      case 'Tempo Run':
      case 'Threshold Run':
        return <Zap size={12} className="intensity-icon tempo" />;
      case 'Long Run':
      case 'Medium Long Run':
        return <Clock size={12} className="intensity-icon long" />;
      default:
        return null;
    }
  };

  // NEW: Workout logging component
  const WorkoutLogger = ({ dateKey, workout, onClose }) => {
    const [actualDistance, setActualDistance] = useState('');
    const [actualPace, setActualPace] = useState('');

    const handleSubmit = (e) => {
      e.preventDefault();
      if (actualDistance && actualPace) {
        logCompletedWorkout(dateKey, actualDistance, actualPace);
        onClose();
      }
    };

    return (
      <div className="workout-logger">
        <h4>Log Completed Workout</h4>
        <p><strong>Planned:</strong> {workout.description}</p>
        <form onSubmit={handleSubmit}>
          <div className="logger-group">
            <label>Actual Distance (miles):</label>
            <input
              type="text"
              value={actualDistance}
              onChange={(e) => setActualDistance(e.target.value)}
              placeholder="e.g., 4.2"
              required
            />
          </div>
          <div className="logger-group">
            <label>Actual Pace (min:sec per mile):</label>
            <input
              type="text"
              value={actualPace}
              onChange={(e) => setActualPace(e.target.value)}
              placeholder="e.g., 7:45"
              required
            />
          </div>
          <div className="logger-buttons">
            <button type="submit" className="save-btn">Log Workout</button>
            <button type="button" onClick={onClose} className="cancel-btn">Cancel</button>
          </div>
        </form>
      </div>
    );
  };

  const WorkoutCard = ({ workout, dateKey }) => {
    const [editText, setEditText] = useState(workout.description);
    const [showLogger, setShowLogger] = useState(false);
    const isEditing = editingWorkout === dateKey;
    const completedWorkout = getCompletedWorkoutForDate(new Date(dateKey));

    const acceptWorkout = () => {
      setWorkouts(prev => {
        const updated = {
          ...prev,
          [dateKey]: { ...prev[dateKey], status: 'accepted' }
        };
        saveData('workouts', updated);
        return updated;
      });
    };

    const rejectWorkout = () => {
      setWorkouts(prev => {
        const newWorkouts = { ...prev };
        delete newWorkouts[dateKey];
        saveData('workouts', newWorkouts);
        return newWorkouts;
      });
    };

    const saveEdit = () => {
      setWorkouts(prev => {
        const updated = {
          ...prev,
          [dateKey]: {
            ...prev[dateKey],
            description: editText,
            status: 'modified'
          }
        };
        saveData('workouts', updated);
        return updated;
      });
      setEditingWorkout(null);
    };

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
                <button onClick={acceptWorkout} className="action-btn accept" title="Accept workout">
                  <Check size={14} />
                </button>
                <button onClick={() => setEditingWorkout(dateKey)} className="action-btn edit" title="Edit workout">
                  <Edit size={14} />
                </button>
                <button onClick={rejectWorkout} className="action-btn reject" title="Reject workout">
                  <X size={14} />
                </button>
              </>
            )}
            {(workout.status === 'accepted' || workout.status === 'modified') && (
              <>
                <button onClick={() => setEditingWorkout(dateKey)} className="action-btn edit" title="Edit workout">
                  <Edit size={14} />
                </button>
                <button onClick={() => setShowLogger(true)} className="action-btn log" title="Log completed workout">
                  <Play size={14} />
                </button>
              </>
            )}
          </div>
        </div>
        
        {showLogger ? (
          <WorkoutLogger 
            dateKey={dateKey} 
            workout={workout} 
            onClose={() => setShowLogger(false)} 
          />
        ) : isEditing ? (
          <div className="edit-form">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="edit-textarea"
              rows="3"
              placeholder="Describe your workout..."
            />
            <div className="edit-buttons">
              <button onClick={saveEdit} className="save-btn">Save</button>
              <button onClick={() => setEditingWorkout(null)} className="cancel-btn">Cancel</button>
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
            
            {/* NEW: Show completed workout summary */}
            {completedWorkout && (
              <div className="completed-summary">
                <strong>Completed:</strong> {completedWorkout.actualDistance} miles at {completedWorkout.actualPace} per mile
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (!hasSetGoals) {
    return (
      <div className="goal-setting-container">
        <div className="goal-header">
          <Target size={32} />
          <h2>Set Your Training Goals</h2>
          <p>Tell us about your race goals so we can create a personalized training plan and calendar</p>
        </div>

        <form onSubmit={handleGoalSubmit} className="goal-form">
          <div className="form-group">
            <label htmlFor="raceType">Race Type:</label>
            <select
              id="raceType"
              value={goalSettings.raceType}
              onChange={(e) => setGoalSettings({...goalSettings, raceType: e.target.value})}
            >
              <option value="Marathon">Marathon (26.2 miles)</option>
              <option value="Half Marathon">Half Marathon (13.1 miles)</option>
              <option value="10K">10K (6.2 miles)</option>
              <option value="5K">5K (3.1 miles)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="raceDate">Race Date:</label>
            <input
              id="raceDate"
              type="date"
              value={goalSettings.raceDate}
              onChange={(e) => {
                setGoalSettings({...goalSettings, raceDate: e.target.value});
                setErrors({...errors, raceDate: ''});
              }}
              min={new Date().toISOString().split('T')[0]}
            />
            {errors.raceDate && <span className="error">{errors.raceDate}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="desiredTime">Goal Time (HH:MM:SS):</label>
            <input
              id="desiredTime"
              type="text"
              value={goalSettings.desiredTime}
              placeholder="03:30:00"
              onChange={(e) => {
                setGoalSettings({...goalSettings, desiredTime: e.target.value});
                setErrors({...errors, desiredTime: ''});
              }}
            />
            {errors.desiredTime && <span className="error">{errors.desiredTime}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="planDays">
              Calendar plan length (days, 1–140):
            </label>
            <input
              id="planDays"
              type="number"
              min={1}
              max={140}
              value={goalSettings.planDays}
              onChange={(e) => {
                setGoalSettings({ ...goalSettings, planDays: e.target.value });
                setErrors({ ...errors, planDays: '' });
              }}
            />
            <p className="form-hint">
              Each day calls the AI coach once. Longer plans take more time and API usage.
            </p>
            {errors.planDays && <span className="error">{errors.planDays}</span>}
          </div>

          <button type="submit" className="generate-plan-btn" disabled={loadingAnalysis || isGenerating}>
            {loadingAnalysis ? 'Analyzing Training Data...' : 'Generate Training Plan & Calendar'}
          </button>
        </form>

        {analysisError && (
          <div className="error-message">
            <h4>Error</h4>
            <p>{analysisError}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="unified-training-container">
      {/* Goal Summary Bar */}
      <div className="goal-summary">
        <div className="goal-item">
          <strong>Goal:</strong> {goalSettings.desiredTime} {goalSettings.raceType}
        </div>
        <div className="goal-item">
          <strong>Race Date:</strong> {new Date(goalSettings.raceDate).toLocaleDateString()}
        </div>
        <button 
          onClick={() => {
            setHasSetGoals(false);
            setWorkouts({});
            setCompletedWorkouts({});
          }} 
          className="change-goals-btn"
        >
          Change Goals
        </button>
      </div>

      {/* Training Calendar */}
      <div className="calendar-section">
        <div className="calendar-header">
          <h2 className="calendar-title">
            <Calendar size={24} />
            Your Training Calendar
          </h2>
          <button
            onClick={() => generatePlanWorkouts(goalSettings.planDays)}
            disabled={isGenerating}
            className="generate-btn"
          >
            <Plus size={18} />
            {isGenerating
              ? generationProgress
                ? `Generating ${generationProgress.current}/${generationProgress.total}...`
                : 'Generating...'
              : `Generate ${goalSettings.planDays || 7}-Day Plan`}
          </button>
        </div>

        {isGenerating && generationProgress && (
          <p className="generation-status">
            Building AI workouts for your calendar: {generationProgress.current} of{' '}
            {generationProgress.total} days complete. Navigate months to see scheduled days.
          </p>
        )}

        <div className="month-navigation">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
            className="nav-btn"
          >
            <ChevronLeft size={24} />
          </button>
          <h3 className="month-title">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
            className="nav-btn"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="weekday-headers">
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
            <div key={day} className="weekday-header">{day}</div>
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
                  <span className="day-number">{date.getDate()}</span>
                  {!workout && hoveredDate === dateKey && isCurrentMonthDate && (
                    <button
                      onClick={() => generateWorkoutForDate(date).then(w => {
                        setWorkouts(prev => {
                          const updated = { ...prev, [dateKey]: w };
                          saveData('workouts', updated);
                          return updated;
                        });
                      })}
                      className="add-workout-btn"
                      title="Generate workout for this day"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </div>
                
                {workout && <WorkoutCard workout={workout} dateKey={dateKey} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="goal-breakdown">
        <h4>Your Goal Breakdown</h4>
        {renderGoalBreakdown()}
      </div>

      {trainingAnalysis && (
        <div className="analysis-summary">
          <h3>Training Analysis & Recommendations</h3>
          <div className="analysis-content">
            {formatAnalysis(trainingAnalysis.analysis)}
          </div>
          <div className="analysis-metadata">
            <p>
              Analysis based on {trainingAnalysis.training_data_used} activities
              {trainingAnalysis.status ? ` | Status: ${trainingAnalysis.status}` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedAITrainingPlan;