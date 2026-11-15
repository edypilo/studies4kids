import { startNewCourse } from '@/lib/actions';
import { STAGE_LABELS, currentSchoolYear, nextSchoolYear, suggestNextCourse, type Course, type Stage } from '@/lib/db';

/** Formulario de "pasar de curso", con el curso siguiente ya propuesto. */
export function NewCourseForm({ profileId, current }: { profileId: number; current: Course | null }) {
  const suggestion = current ? suggestNextCourse(current) : { name: '', stage: 'primaria' as Stage };
  const year = current ? nextSchoolYear(current.school_year) : currentSchoolYear();
  return (
    <form action={startNewCourse} className="row">
      <input type="hidden" name="profileId" value={profileId} />
      <input
        name="name"
        className="grow"
        placeholder="Curso (p. ej. 1º ESO)"
        aria-label="Nombre del curso"
        defaultValue={suggestion.name}
        maxLength={40}
        required
      />
      <select name="stage" aria-label="Etapa" defaultValue={suggestion.stage}>
        {Object.entries(STAGE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <input
        name="school_year"
        aria-label="Año escolar"
        defaultValue={year}
        pattern="\d{4}-\d{4}"
        title="Formato 2027-2028"
        size={10}
        required
      />
      <button className="btn">Empezar curso</button>
    </form>
  );
}
