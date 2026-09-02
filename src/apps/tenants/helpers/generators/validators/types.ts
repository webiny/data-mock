export interface DateValidationSettings {
  value: string;
  type: "time" | string;
}

export interface LengthValidationSettings {
  value: string;
}

export interface PatternValidationSettings {
  preset?: string;
  regex: string;
  flags?: string;
}
