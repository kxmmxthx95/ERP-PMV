import type { Student } from '@/types/student';

export interface StudentCompletionStatus {
  isComplete: boolean;
  categories: {
    personal: boolean;
    family: boolean;
    education: boolean;
  };
  missingFields: string[];
}

export function checkStudentCompletion(student: Student): StudentCompletionStatus {
  const missingFields: string[] = [];
  
  // 1. Personal Info
  const personalFields: (keyof Student)[] = [
    'studentCode',
    'prefix',
    'firstName',
    'lastName',
    'gender',
    'birthDate',
    'phone',
    'financial_dailyAllowance',
    'financial_status'
  ];
  
  const personalComplete = personalFields.every(field => {
    const value = student[field];
    const isMissing = value === undefined || value === null || value === '';
    if (isMissing) missingFields.push(`personal.${field}`);
    return !isMissing;
  });

  // 2. Family Info
  // Criteria: has familyCount > 0 AND has at least one family member
  const familyCountValid = student.familyCount !== undefined && student.familyCount !== null && student.familyCount > 0;
  const familyMembersValid = (student.familyMembers?.length ?? 0) > 0;
  const familyComplete = familyCountValid && familyMembersValid;
  
  if (!familyCountValid) missingFields.push('family.familyCount');
  if (!familyMembersValid) missingFields.push('family.familyMembers');

  // 3. Education Info
  const educationFields: (keyof Student)[] = [
    'edu_favoriteSubject',
    'edu_leastFavoriteSubject',
    'edu_selfPerception'
  ];
  
  const educationComplete = educationFields.every(field => {
    const value = student[field];
    const isMissing = value === undefined || value === null || value === '';
    if (isMissing) missingFields.push(`education.${field}`);
    return !isMissing;
  });

  return {
    isComplete: personalComplete && familyComplete && educationComplete,
    categories: {
      personal: personalComplete,
      family: familyComplete,
      education: educationComplete
    },
    missingFields
  };
}
