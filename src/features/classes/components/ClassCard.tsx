import type { ClassRoomCard } from '@/types/class';
import { cn } from '@/lib/utils';

interface ClassCardProps {
  card: ClassRoomCard;
  fill?: boolean;
}

function ClassCardPattern() {
  return (
    <>
      <div className="pointer-events-none absolute -left-[18%] -top-[35%] w-[58%] aspect-square rounded-full bg-white/10" />
      <div className="pointer-events-none absolute right-[10%] top-[18%] w-[26%] aspect-square rotate-45 rounded-xl bg-white/[0.08]" />
      <div className="pointer-events-none absolute -right-[8%] bottom-[5%] w-[38%] aspect-square rounded-full border-[3px] border-white/12 bg-transparent" />
    </>
  );
}

function TeacherAvatar({
  name,
  photoURL,
  sizeClass,
  textClass,
}: {
  name: string;
  photoURL?: string;
  sizeClass: string;
  textClass: string;
}) {
  return (
    <div
      className={`${sizeClass} rounded-full overflow-hidden border border-white/70 bg-white/20 shrink-0 flex items-center justify-center`}
    >
      {photoURL ? (
        <img src={photoURL} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className={`text-white font-bold ${textClass}`}>
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

export default function ClassCard({ card, fill = false }: ClassCardProps) {
  const { classRoom, homeroomTeachers, isFull } = card;
  const teachers = homeroomTeachers.length > 0
    ? homeroomTeachers
    : card.homeroomTeacher
      ? [card.homeroomTeacher]
      : [];
  const multiTeacher = teachers.length > 1;

  return (
    <div className={cn('group cursor-pointer select-none', fill && 'h-full w-full')}>
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-2xl shadow-md transition-all duration-300 group-hover:opacity-95 group-hover:shadow-xl bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700',
          fill ? 'aspect-[2.4/1]' : 'aspect-[2.6/1] lg:aspect-square',
        )}
      >
        <ClassCardPattern />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.28) 0%, transparent 50%)' }}
        />

        {isFull && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-400 shadow-sm" />
          </div>
        )}

        <div className={`absolute top-2 right-2 z-10 flex flex-col items-end gap-1 ${multiTeacher ? 'max-w-[88%]' : 'max-w-[75%]'}`}>
          {teachers.length === 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/90 font-semibold text-right">
                ยังไม่ระบุครู
              </span>
              <TeacherAvatar name="?" sizeClass="w-10 h-10" textClass="text-[11px]" />
            </div>
          ) : (
            teachers.map((teacher) => (
              <div key={teacher.id} className="flex items-center gap-1.5 justify-end min-w-0 w-full">
                <span
                  className={`text-white/90 font-semibold text-right leading-snug ${
                    multiTeacher
                      ? 'text-[8.5px] line-clamp-2 max-w-[calc(100%-2rem)]'
                      : 'text-[10px] truncate max-w-[calc(100%-2.75rem)]'
                  }`}
                  title={teacher.name}
                >
                  {teacher.name}
                </span>
                <TeacherAvatar
                  name={teacher.name}
                  photoURL={teacher.photoURL}
                  sizeClass={multiTeacher ? 'w-8 h-8' : 'w-10 h-10'}
                  textClass={multiTeacher ? 'text-[9px]' : 'text-[11px]'}
                />
              </div>
            ))
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-2 z-10">
          <h4
            className="text-white font-semibold leading-tight line-clamp-2"
            style={{ fontSize: 'clamp(18px, 3.8vw, 22px)', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
          >
            {classRoom.className}
          </h4>
        </div>
      </div>
    </div>
  );
}
