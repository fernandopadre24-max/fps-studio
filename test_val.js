
window = {};
function showToast(a, b) { console.log(a, b); }
window.validarHorarioEstudio = function(horaInicio, horaFim) {
    if (!horaInicio || !horaFim) return true;
    
    const parseTime = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        return (h * 60) + (m || 0);
    };
    
    const inicioTotal = parseTime(horaInicio);
    const fimTotal = parseTime(horaFim);
    
    const expedienteInicio = 8 * 60; // 08:00
    const expedienteFim = 22 * 60;   // 22:00
    
    if (inicioTotal < expedienteInicio || fimTotal > expedienteFim) {
        showToast('O horário solicitado está fora do expediente (08:00 às 22:00).', 'warning');
        return false;
    }
    if (inicioTotal >= fimTotal) {
        showToast('A hora final deve ser maior que a hora inicial.', 'warning');
        return false;
    }
    return true;
};
console.log("07:00-09:00", window.validarHorarioEstudio('07:00', '09:00'));
console.log("08:00-22:00", window.validarHorarioEstudio('08:00', '22:00'));
console.log("21:00-23:00", window.validarHorarioEstudio('21:00', '23:00'));
console.log("10:00-09:00", window.validarHorarioEstudio('10:00', '09:00'));
console.log("10:00-11:00", window.validarHorarioEstudio('10:00', '11:00'));
