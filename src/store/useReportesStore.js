import { create } from 'zustand';

// Reutilizamos tu lógica robusta de extracción de fecha local
const obtenerFechaLocalStr = (fecha = new Date()) => {
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getRangoPorDefecto = () => {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return {
    desde: obtenerFechaLocalStr(inicioMes),
    hasta: obtenerFechaLocalStr(hoy)
  };
};

const initialState = getRangoPorDefecto();

// 1. EXPORTACIÓN NOMBRADA (El escudo principal)
export const useReportesStore = create((set) => ({
  fechaDesde: initialState.desde,
  fechaHasta: initialState.hasta,
  setRangoFechas: (desde, hasta) => set({ fechaDesde: desde, fechaHasta: hasta }),
  resetFechas: () => set(getRangoPorDefecto()),
}));

// 2. EXPORTACIÓN POR DEFECTO (Compatibilidad hacia atrás)
export default useReportesStore;