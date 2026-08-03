export type RotaEmployee = {
  id: string;
  department_id?: string | null;
  office_location?: string | null;
};

export type RotaStatus = {
  code: string;
  label: string;
  detail?: string;
  overtimeHours?: number;
};

export const ROTA_LABELS: Record<string, string> = {
  D: "Working – Day",
  N: "Working – Night",
  R: "Off – Rest",
  OFF: "Off",
  AL: "Annual Leave",
  SL: "Sick Leave",
  ML: "Marriage Leave",
  MAT: "Maternity Leave",
  NB: "Nursing Break",
  PAT: "Paternity Leave",
  BL: "Bereavement Leave",
  UL: "Unpaid Leave",
  WFH: "Remote Work",
  BT: "Business Travel",
  TR: "Training",
  PH: "Public Holiday",
  OT: "Approved Overtime",
};

export function isoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function datesBetween(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  for (let date = new Date(start); date <= end; date = addUtcDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

function scopeMatches(item: any, employee: RotaEmployee): boolean {
  const departmentMatches = !item.department_id || item.department_id === employee.department_id;
  const locationMatches =
    !item.office_location ||
    String(item.office_location).trim().toLowerCase() ===
      String(employee.office_location || "").trim().toLowerCase();
  return departmentMatches && locationMatches;
}

function holidayMatches(item: any, employee: RotaEmployee, dateText: string): boolean {
  if (item.active === false || !scopeMatches(item, employee)) return false;
  const start = String(item.start_date || item.holiday_date || "").slice(0, 10);
  const end = String(item.end_date || item.start_date || item.holiday_date || "").slice(0, 10);
  return Boolean(start && end && start <= dateText && end >= dateText);
}

function isExplicitOverride(assignment: any): boolean {
  const source = String(assignment?.source || "manual").toLowerCase();
  return !["annual_pattern", "generated", "system", "rotation_pattern"].includes(source);
}

export function statusForDate(args: {
  employee: RotaEmployee;
  date: Date;
  assignments: any[];
  holidays: any[];
  leaves: any[];
  rotations: any[];
  overtime?: any[];
}): RotaStatus {
  const { employee, date, assignments, holidays, leaves, rotations, overtime = [] } = args;
  const dateText = isoDate(date);
  const overtimeHours = overtime
    .filter((item) => item.employee_id === employee.id && String(item.overtime_date).slice(0, 10) === dateText)
    .reduce((sum, item) => sum + Number(item.requested_hours || 0), 0);

  // Approved leave is always the primary status.
  const leave = leaves.find(
    (item) => item.employee_id === employee.id && item.start_date <= dateText && item.end_date >= dateText
  );
  if (leave) {
    const code = leave.leave_types?.code || "AL";
    return {
      code,
      label: leave.leave_types?.name || ROTA_LABELS[code] || "Leave",
      detail: leave.reason || undefined,
      overtimeHours: overtimeHours || undefined,
    };
  }

  const dayAssignment = assignments.find(
    (item) => item.employee_id === employee.id && String(item.work_date).slice(0, 10) === dateText
  );

  // A deliberate Admin/HR override remains above holidays.
  if (dayAssignment && isExplicitOverride(dayAssignment)) {
    const code = dayAssignment.status_code || "D";
    return {
      code,
      label: ROTA_LABELS[code] || code,
      detail: dayAssignment.note || undefined,
      overtimeHours: overtimeHours || undefined,
    };
  }

  // Generated annual-plan assignments are the normal base schedule, not a manual override.
  let baseCode = dayAssignment?.status_code || "D";
  if (!dayAssignment) {
    const rotation = rotations.find(
      (item) =>
        item.employee_id === employee.id &&
        item.effective_from <= dateText &&
        (!item.effective_to || item.effective_to >= dateText)
    );
    const pattern = rotation?.rotation_patterns;
    if (rotation && pattern) {
      // Office/full-time staff always follow the company working week:
      // Sunday–Thursday ON, Friday–Saturday OFF. This is calendar based,
      // so it remains correct regardless of the assignment anchor date.
      if (String(pattern.rotation_type || "").toLowerCase() === "office") {
        const dow = date.getUTCDay();
        baseCode = dow === 5 || dow === 6 ? "R" : pattern.default_shift_code || "D";
      } else {
        const anchor = new Date(`${rotation.cycle_anchor_date}T00:00:00Z`);
        const diff = Math.floor((date.getTime() - anchor.getTime()) / 86400000);
        const daysOn = Number(pattern.days_on || 0);
        const daysOff = Number(pattern.days_off || 0);
        const cycle = daysOn + daysOff;
        if (cycle > 0) {
          let index = diff % cycle;
          if (index < 0) index += cycle;
          const on = rotation.start_status === "OFF" ? index >= daysOff : index < daysOn;
          baseCode = on ? pattern.default_shift_code || "D" : "R";
        }
      }
    } else {
      const dow = date.getUTCDay();
      baseCode = dow === 5 || dow === 6 ? "R" : "D";
    }
  }

  // Public/company holidays replace generated/normal working days but preserve weekends/rest days.
  const holiday = holidays.find((item) => holidayMatches(item, employee, dateText));
  if (holiday && !["R", "OFF"].includes(String(baseCode).toUpperCase())) {
    return {
      code: "PH",
      label: holiday.name || "Public Holiday",
      overtimeHours: overtimeHours || undefined,
    };
  }

  return {
    code: baseCode,
    label: ROTA_LABELS[baseCode] || baseCode,
    overtimeHours: overtimeHours || undefined,
  };
}

export function isWorkingStatus(code: string): boolean {
  return !["R", "OFF", "PH"].includes(code);
}
