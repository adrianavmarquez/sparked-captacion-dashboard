import { AdapterError, type DataAdapter } from './adapter';

/** Todas las lecturas fallan con el estado de error ya diseñado. No cae a fixtures. */
export class UnavailableAdapter implements DataAdapter {
  constructor(private readonly failure = new AdapterError('network', 'No se pudo leer la fuente de datos.')) {}
  listProspects() { return Promise.reject(this.failure); }
  getProspect() { return Promise.reject(this.failure); }
  getAudit() { return Promise.reject(this.failure); }
  getAgentSteps() { return Promise.reject(this.failure); }
  getDiscardReasons() { return Promise.reject(this.failure); }
  saveReview() { return Promise.reject(this.failure); }
  saveFit() { return Promise.reject(this.failure); }
  setClosedStep() { return Promise.reject(this.failure); }
  moveStage() { return Promise.reject(this.failure); }
  listDrafts() { return Promise.reject(this.failure); }
  approveDraft() { return Promise.reject(this.failure); }
  listFollowups() { return Promise.reject(this.failure); }
  listOpportunities() { return Promise.reject(this.failure); }
  getGoalProgress() { return Promise.reject(this.failure); }
  getLocalities() { return Promise.reject(this.failure); }
  getMeta() { return Promise.reject(this.failure); }
  optOut() { return Promise.reject(this.failure); }
  createOpportunity() { return Promise.reject(this.failure); }
  updateOpportunity() { return Promise.reject(this.failure); }
}
