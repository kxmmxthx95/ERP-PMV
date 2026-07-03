import type { Student } from '@/types/student';

export interface StudentCompletionStatus {
  isComplete: boolean;
  categories: {
    personal: boolean;
    family: boolean;
    map: boolean;
  };
  missingFields: string[];
}

function isFilled(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  return true;
}

function isNationalIdValid(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return value.replace(/\D/g, '').length === 13;
}

function checkFields(student: Student, fields: (keyof Student)[], prefix: string, missingFields: string[]): boolean {
  return fields.every(field => {
    const value = student[field];
    const ok = isFilled(value) || (field === 'financial_dailySavings' && value === 0);
    if (!ok) missingFields.push(`${prefix}.${field}`);
    return ok;
  });
}

export function checkStudentCompletion(student: Student): StudentCompletionStatus {
  const missingFields: string[] = [];

  const personalFieldsOk = checkFields(
    student,
    [
      'prefix',
      'firstName',
      'lastName',
      'nickname',
      'bloodType',
      'phone',
      'email',
      'birthDate',
      'financial_dailyAllowance',
      'financial_dailySavings',
    ],
    'personal',
    missingFields,
  );
  const nationalIdOk = isNationalIdValid(student.nationalId);
  if (!nationalIdOk) missingFields.push('personal.nationalId');
  const personalComplete = personalFieldsOk && nationalIdOk;

  const fatherComplete = checkFields(
    student,
    [
      'father_prefix',
      'father_firstName',
      'father_lastName',
      'father_phone',
      'father_education',
      'father_occupation',
      'father_salary',
    ],
    'family.father',
    missingFields,
  );

  const motherComplete = checkFields(
    student,
    [
      'mother_prefix',
      'mother_firstName',
      'mother_lastName',
      'mother_phone',
      'mother_education',
      'mother_occupation',
      'mother_salary',
    ],
    'family.mother',
    missingFields,
  );

  let guardianComplete = isFilled(student.guardianType);
  if (!guardianComplete) missingFields.push('family.guardianType');

  if (student.guardianType === 'other') {
    guardianComplete = checkFields(
      student,
      [
        'guardianPrefix',
        'guardianFirstName',
        'guardianLastName',
        'guardianPhone',
        'guardian_education',
        'guardian_occupation',
        'guardian_salary',
      ],
      'family.guardian',
      missingFields,
    ) && guardianComplete;
  }

  const familyComplete = fatherComplete && motherComplete && guardianComplete;

  const mapComplete = checkFields(
    student,
    [
      'address_houseNo',
      'address_moo',
      'address_village',
      'address_subdistrict',
      'address_district',
      'address_province',
      'address_postalCode',
      'address_latitude',
      'address_longitude',
    ],
    'map',
    missingFields,
  );

  return {
    isComplete: personalComplete && familyComplete && mapComplete,
    categories: {
      personal: personalComplete,
      family: familyComplete,
      map: mapComplete,
    },
    missingFields,
  };
}
