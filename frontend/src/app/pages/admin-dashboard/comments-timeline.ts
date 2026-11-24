import { CommentsPerDay } from '../../services/statistics';

/** Punto ya posicionado en el sistema de coordenadas del SVG (600 x 200). */
export interface TimelinePoint {
  fecha: string;
  cantidad: number;
  x: number;
  y: number;
}

/** Datos listos para dibujar: puntos, línea y etiquetas de los ejes. */
export interface CommentsTimeline {
  points: TimelinePoint[];
  line: string;
  start: string;
  end: string;
  max: number;
}

/** Convierte YYYY-MM-DD en DD/MM/YYYY para mostrarlo al usuario. */
export function formatTimelineDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Transforma los días con comentarios en puntos de una línea de tiempo.
 * Devuelve null si no hay datos que dibujar.
 */
export function buildCommentsTimeline(
  days: CommentsPerDay[],
  from: string,
  to: string,
): CommentsTimeline | null {
  if (!days.length) return null;

  const dayMs = 24 * 60 * 60 * 1000;
  const timestamp = (date: string) => Date.parse(`${date}T00:00:00.000Z`);
  const dateAt = (time: number) => new Date(time).toISOString().slice(0, 10);
  const start = from || days[0].fecha;
  const end = to || days[days.length - 1].fecha;
  const startTime = timestamp(start);
  const endTime = timestamp(end);
  const max = days.reduce((highest, day) => Math.max(highest, day.cantidad), 0);
  const expanded: CommentsPerDay[] = [];

  // Solo se agregan los extremos de cada hueco: representan los días sin
  // comentarios sin generar miles de puntos cuando el período es muy largo.
  for (const day of days) {
    const previous = expanded[expanded.length - 1];
    const previousTime = previous ? timestamp(previous.fecha) : startTime - dayMs;
    const currentTime = timestamp(day.fecha);
    if (currentTime - previousTime > dayMs) {
      expanded.push({ fecha: dateAt(previousTime + dayMs), cantidad: 0 });
      if (currentTime - previousTime > 2 * dayMs) {
        expanded.push({ fecha: dateAt(currentTime - dayMs), cantidad: 0 });
      }
    }
    expanded.push(day);
  }
  const lastTime = timestamp(days[days.length - 1].fecha);
  if (lastTime < endTime) {
    expanded.push({ fecha: dateAt(lastTime + dayMs), cantidad: 0 });
    if (lastTime + dayMs < endTime) expanded.push({ fecha: end, cantidad: 0 });
  }

  // viewBox es 600 x 200 y deja 8 unidades de margen: X va de 8 a 592
  // según el tiempo transcurrido, no según la posición de cada fila.
  // Si el rango tiene un solo día, el punto se centra en x=300.
  // En SVG Y crece hacia abajo: 0 comentarios queda en y=192 y el máximo
  // en y=8; los valores intermedios se escalan proporcionalmente.
  const points = expanded.map((day) => ({
    ...day,
    x: startTime === endTime ? 300 : 8 + ((timestamp(day.fecha) - startTime) / (endTime - startTime)) * 584,
    y: 192 - (day.cantidad / max) * 184,
  }));
  return {
    points,
    // polyline recibe pares "x,y" separados por espacios y los une en orden.
    line: points.map((point) => `${point.x},${point.y}`).join(' '),
    start: formatTimelineDate(start),
    end: formatTimelineDate(end),
    max,
  };
}
