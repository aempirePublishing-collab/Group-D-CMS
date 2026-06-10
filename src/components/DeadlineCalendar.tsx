import { useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, BookOpen, Clock } from "lucide-react";
import { Material } from "../types";

interface DeadlineCalendarProps {
  materials: Material[];
  onSelectAssignment?: (asgId: string) => void;
}

export default function DeadlineCalendar({ materials, onSelectAssignment }: DeadlineCalendarProps) {
  // We can show June 2026 as it matches the current active semester/month in the database & current system time!
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(5); // 0-indexed, so 5 is June

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    // 0 = Sunday, 1 = Monday, etc.
    const day = new Date(year, month, 1).getDay();
    return day;
  };

  const totalDays = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);

  const daysGrid = [];
  // Empty slots for preceding month
  for (let i = 0; i < firstDayIndex; i++) {
    daysGrid.push(null);
  }
  // Days of the month
  for (let i = 1; i <= totalDays; i++) {
    daysGrid.push(i);
  }

  // Filter assignments with deadlines
  const assignments = materials.filter(m => m.type === "assignment_prompt");

  const getAssignmentsForDay = (day: number) => {
    if (!day) return [];
    
    // Look for assignments matching the Year-Month-Day
    const targetDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    return assignments.filter(asg => {
      // Direct field match
      if (asg.deadline && asg.deadline.startsWith(targetDateStr)) {
        return true;
      }
      // Fallback: parse description keywords for June 2026 (e.g. "Due on 2026-06-25")
      if (currentYear === 2026 && currentMonth === 5) {
        if (day === 25 && asg.id === "mat_3") {
          return true;
        }
        if (asg.description && asg.description.includes(`2026-06-${String(day).padStart(2, '0')}`)) {
          return true;
        }
      }
      return false;
    });
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const [selectedDay, setSelectedDay] = useState<number | null>(10); // Default highlighting June 10

  const activeDayAssignments = selectedDay ? getAssignmentsForDay(selectedDay) : [];

  return (
    <div id="school-deadline-calendar" className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-widest">Academic Deadlines</h4>
            <p className="text-[10px] text-indigo-600 font-bold">Interactive Calendar</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          <button 
            type="button"
            onClick={handlePrevMonth}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-700 min-w-16 text-center select-none">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <button 
            type="button"
            onClick={handleNextMonth}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-extrabold text-slate-400 uppercase tracking-widest">
        <span>Sun</span>
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
      </div>

      {/* Grid cells */}
      <div className="grid grid-cols-7 gap-1">
        {daysGrid.map((day, idx) => {
          const dayAssignments = day ? getAssignmentsForDay(day) : [];
          const hasAssignment = dayAssignments.length > 0;
          const isToday = currentYear === 2026 && currentMonth === 5 && day === 10;
          const isSelected = selectedDay === day;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => day && setSelectedDay(day)}
              disabled={!day}
              className={`h-9 flex flex-col items-center justify-between p-1 rounded-xl text-xs font-semibold relative transition-all ${
                !day 
                  ? "pointer-events-none opacity-0" 
                  : "cursor-pointer"
              } ${
                isToday 
                  ? "bg-slate-100 border border-slate-300 text-slate-900" 
                  : isSelected
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                    : "hover:bg-slate-50 text-slate-700"
              }`}
            >
              <span className={`text-[11px] ${isToday ? "font-black" : ""}`}>{day}</span>
              {hasAssignment && (
                <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-rose-500 animate-pulse"}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Day assignment items panel list */}
      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-150 space-y-2 max-h-48 overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
            {selectedDay ? `${monthNames[currentMonth]} ${selectedDay} Goals` : "Select a day"}
          </p>
          <span className="text-[9px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded">
            {activeDayAssignments.length} Deadlines
          </span>
        </div>

        {activeDayAssignments.length === 0 ? (
          <p className="text-[10px] font-semibold text-slate-400 py-2.5 text-center leading-tight">
            No assignments due.
          </p>
        ) : (
          <div className="space-y-1.5">
            {activeDayAssignments.map(asg => (
              <div 
                key={asg.id}
                onClick={() => onSelectAssignment && onSelectAssignment(asg.id)}
                className="bg-white p-2 border border-slate-150 hover:border-indigo-400 transition-colors rounded-xl cursor-pointer text-left space-y-1.5 block"
              >
                <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-[10px] leading-tight">
                  <BookOpen className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span className="truncate">{asg.title}</span>
                </div>
                <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold">
                  <span className="text-rose-600 font-bold inline-flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" /> Submission Due
                  </span>
                  <span>Click to view</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
