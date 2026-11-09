import { EMPLOYEE_TOUR } from '../../shared/tours.js';

// Tour steps for this person: the Today steps (needs: 'routine') only when
// HR has given them a routine, so the tour never points at a missing tab.
export function employeeTourSteps(hasRoutine) {
  return EMPLOYEE_TOUR.filter((step) => step.needs !== 'routine' || !!hasRoutine);
}
