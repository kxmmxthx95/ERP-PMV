import { useState, useEffect } from 'react';

export interface ScheduleSettings {
  periodCount: number;
  lunchPeriod: number;
  periodTimes: Record<number, string>;
}

const DEFAULT_SETTINGS: ScheduleSettings = {
  periodCount: 8,
  lunchPeriod: 6,
  periodTimes: {
    1: '08:30 - 09:20',
    2: '09:20 - 10:10',
    3: '10:10 - 11:00',
    4: '11:00 - 11:50',
    5: '11:50 - 12:40',
    6: '12:40 - 13:30', // Default Lunch
    7: '13:30 - 14:20',
    8: '14:20 - 15:10',
  }
};

export function useScheduleSettings() {
  const [settings, setSettings] = useState<ScheduleSettings>(() => {
    try {
      const stored = localStorage.getItem('schedule_settings');
      return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    localStorage.setItem('schedule_settings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: Partial<ScheduleSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  return {
    ...settings,
    updateSettings
  };
}