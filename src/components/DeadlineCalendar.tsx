import React, { useState, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, BookOpen, Clock, RefreshCw, Check } from "lucide-react";
import { Material, Submission } from "../types";

interface DeadlineCalendarProps {
  materials: Material[];
  submissions?: Submission[];
  onMarkAsSubmitted?: (asgId: string) => void;
  onSelectAssignment?: (asgId: string) => void;
  googleToken?: string | null;
  onConnectGoogle?: () => void;
}

export default function DeadlineCalendar({
  materials,
  submissions = [],
  onMarkAsSubmitted,
  onSelectAssignment,
  googleToken,
  onConnectGoogle
}: DeadlineCalendarProps) {
  // We can show June 2026 as it matches the current active semester/month in the database
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(5); // June (0-indexed)

  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [exportingAsgId, setExportingAsgId] = useState<string | null>(null);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const totalDays = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);

  const daysGrid = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysGrid.push(null);
  }
  for (let i = 1; i <= totalDays; i++) {
    daysGrid.push(i);
  }

  // Fetch Google calendar events when token or current month/year changes
  useEffect(() => {
    if (!googleToken) {
      setGoogleEvents([]);
      return;
    }

    const fetchGoogleEvents = async () => {
      setIsLoadingGoogle(true);
      try {
        // Build start and end dates for selected month
        const startIso = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01T00:00:00Z`;
        const endIso = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-31T23:59:59Z`; // simple fallback date

        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startIso}&timeMax=${endIso}&singleEvents=true`,
          {
            headers: { Authorization: `Bearer ${googleToken}` }
          }
        );
        if (res.ok) {
          const data = await res.json();
          setGoogleEvents(data.items || []);
        } else {
          console.warn("Google Calendar fetch failed. Status:", res.status);
        }
      } catch (err) {
        console.error("Error fetching Google Calendar events:", err);
      } finally {
        setIsLoadingGoogle(false);
      }
    };

    fetchGoogleEvents();
  }, [googleToken, currentMonth, currentYear]);

  // Filter assignments with deadlines
  const assignments = materials.filter(m => m.type === "assignment_prompt");

  const getAssignmentsForDay = (day: number) => {
    if (!day) return [];
    const targetDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    return assignments.filter(asg => {
      if (asg.deadline && asg.deadline.startsWith(targetDateStr)) {
        return true;
      }
      if (currentYear === 2026 && currentMonth === 5) {
        if (day === 25 && asg.id === "mat_3") {
          return true;
        }
        if (asg.description && asg.description.includes(`2026-06-${String(day).padStart(2, "0")}`)) {
          return true;
        }
      }
      return false;
    });
  };

  const getGoogleEventsForDay = (day: number) => {
    if (!day || googleEvents.length === 0) return [];
    const targetDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    return googleEvents.filter(evt => {
      const startDateTime = evt.start?.dateTime || evt.start?.date || "";
      return startDateTime.startsWith(targetDateStr);
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
  const activeDayGoogleEvents = selectedDay ? getGoogleEventsForDay(selectedDay) : [];

  const handleExportToGoogleCalendar = async (asg: Material, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!googleToken) {
      alert("Please connect Google Calendar first!");
      return;
    }

    setExportingAsgId(asg.id);
    try {
      let deadlineDate = asg.deadline;
      if (!deadlineDate) {
        deadlineDate = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-25T23:59:00Z`;
      } else if (!deadlineDate.includes("T")) {
        deadlineDate = `${deadlineDate}T23:59:00Z`;
      }

      const evtBody = {
        summary: `🚨 Deadline: ${asg.title}`,
        description: `Academic assessment deadline exported from GDCMS portal. ${asg.description || ""}`,
        start: {
          dateTime: deadlineDate,
          timeZone: "GMT"
        },
        end: {
          dateTime: new Date(new Date(deadlineDate).getTime() + 60 * 60 * 1000).toISOString(),
          timeZone: "GMT"
        }
      };

      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(evtBody)
      });

      if (res.ok) {
        alert("Success: Assessment deadline exported to your Google Calendar!");
        const newEvt = await res.json();
        setGoogleEvents(prev => [...prev, newEvt]);
      } else {
        const txt = await res.text();
        console.error("Export response state error:", txt);
        alert("Google declined event creation. Check Calendar write scopes.");
      }
    } catch (err) {
      console.error("Post exception:", err);
      alert("Communication error during export.");
    } finally {
      setExportingAsgId(null);
    }
  };

  return (
    <div id="school-deadline-calendar" className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-widest">Academic Calendar</h4>
            <p className="text-[10px] text-indigo-600 font-bold">Google Calendar Integration</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Sync Button */}
          {!googleToken ? (
            <button
              type="button"
              onClick={onConnectGoogle}
              className="px-2.5 py-1 text-[9px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-850 border border-indigo-150 font-black tracking-wide rounded-lg transition-all flex items-center gap-1 cursor-pointer"
            >
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></span>
              Connect Google Calendar
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-lg">
              <span className="w-1 h-1 bg-emerald-500 rounded-full"></span>
              <span>Google Calendar Synced</span>
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-150 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-black text-slate-700 min-w-16 text-center select-none uppercase tracking-wide">
              {monthNames[currentMonth]} {currentYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {isLoadingGoogle && (
        <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400 py-1 bg-slate-50 rounded-lg animate-pulse">
          <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
          <span>Syncing events from Google Calendar cloud...</span>
        </div>
      )}

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
          const dayGoogleEvents = day ? getGoogleEventsForDay(day) : [];

          const hasAssignment = dayAssignments.length > 0;
          const hasGoogleEvent = dayGoogleEvents.length > 0;

          // Check if any assignment on this day is still uncompleted/unsubmitted
          const hasUncompletedAssignment = dayAssignments.some(asg => {
            const isSubmitted = submissions.some(sub => sub.assignmentId === asg.id);
            return !isSubmitted;
          });

          const isToday = currentYear === 2026 && currentMonth === 5 && day === 10;
          const isSelected = selectedDay === day;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => day && setSelectedDay(day)}
              disabled={!day}
              className={`h-9 flex flex-col items-center justify-between p-1 rounded-xl text-xs font-semibold relative transition-all ${
                !day ? "pointer-events-none opacity-0" : "cursor-pointer"
              } ${
                isToday
                  ? "bg-slate-100 border border-slate-300 text-slate-900"
                  : isSelected
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                    : "hover:bg-slate-50 text-slate-700"
              }`}
            >
              <span className={`text-[11px] ${isToday ? "font-black" : ""}`}>{day}</span>
              
              <div className="flex gap-0.5 justify-center mt-0.5">
                {hasAssignment && (
                  <div
                    className={`w-1 h-1 rounded-full ${
                      isSelected 
                        ? "bg-white" 
                        : hasUncompletedAssignment 
                          ? "bg-rose-500 animate-pulse" 
                          : "bg-emerald-500"
                    }`}
                    title={hasUncompletedAssignment ? "Pending Deadline" : "Syllabus Submitted"}
                  />
                )}
                {hasGoogleEvent && (
                  <div
                    className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-emerald-500"}`}
                    title="Google Event"
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Combined listings panel inside selected date */}
      <div className="bg-slate-50 rounded-2xl p-3 border border-slate-150 space-y-2 max-h-48 overflow-y-auto">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
            {selectedDay ? `${monthNames[currentMonth]} ${selectedDay} Schedule` : "Select a day"}
          </p>
          <span className="text-[9px] bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded">
            {activeDayAssignments.length + activeDayGoogleEvents.length} Items
          </span>
        </div>

        {activeDayAssignments.length === 0 && activeDayGoogleEvents.length === 0 ? (
          <p className="text-[10px] font-semibold text-slate-400 py-2.5 text-center leading-tight">
            Clear agenda. No assignments or calendar events schedule.
          </p>
        ) : (
          <div className="space-y-1.5">
            {/* Local Assessment Deadlines list */}
            {activeDayAssignments.map(asg => {
              const isSubmitted = submissions.some(sub => sub.assignmentId === asg.id);
              return (
                <div
                  key={asg.id}
                  onClick={() => onSelectAssignment && onSelectAssignment(asg.id)}
                  className="bg-white p-2.5 border border-slate-150 hover:border-indigo-400 transition-colors rounded-xl cursor-pointer text-left space-y-1.5 block relative group"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 text-indigo-700 font-bold text-[10px] leading-tight truncate">
                      <BookOpen className="w-3 h-3 text-indigo-500 shrink-0" />
                      <span className="truncate">{asg.title}</span>
                    </div>
                    
                    {googleToken && (
                      <button
                        type="button"
                        disabled={exportingAsgId === asg.id}
                        onClick={(e) => handleExportToGoogleCalendar(asg, e)}
                        className="text-[8px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black px-1.5 py-0.5 rounded border border-emerald-150 transition-colors shrink-0 cursor-pointer ml-1"
                        title="Add this deadline event to Google Calendar"
                      >
                        {exportingAsgId === asg.id ? "Adding..." : "+ Google Cal"}
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-[9px] font-bold">
                    {isSubmitted ? (
                      <span className="text-emerald-600 font-black inline-flex items-center gap-0.5 bg-emerald-50/50 px-1.5 py-0.5 rounded border border-emerald-100">
                        <Check className="w-2.5 h-2.5" /> Handed In
                      </span>
                    ) : (
                      <span className="text-rose-600 font-bold inline-flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> Assessment Deadline
                      </span>
                    )}
                    <span className="text-slate-400">Click to view assignment</span>
                  </div>

                  {!isSubmitted && onMarkAsSubmitted && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkAsSubmitted(asg.id);
                        }}
                        className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-850 font-extrabold text-[9px] uppercase tracking-wider rounded-lg border border-indigo-200 transition-all cursor-pointer text-center block active:scale-97"
                      >
                        ✓ Mark as Submitted
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Google Calendar sync schedules list */}
            {activeDayGoogleEvents.map(evt => (
              <div
                key={evt.id}
                className="bg-emerald-50/50 p-2 border border-emerald-100 hover:border-emerald-300 transition-colors rounded-xl text-left space-y-1 block"
              >
                <div className="flex items-center gap-1 text-emerald-800 font-black text-[10px] leading-tight">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0"></span>
                  <span className="truncate">{evt.summary || "Google Calendar Event"}</span>
                </div>
                {evt.description && (
                  <p className="text-[9px] text-slate-500 truncate leading-none pl-3 font-normal">
                    {evt.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold pl-3">
                  <span>
                    {evt.start?.dateTime
                      ? new Date(evt.start.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "All Day"}
                  </span>
                  <span className="text-emerald-700 font-extrabold text-[8px] tracking-wider uppercase">Google Sync</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
