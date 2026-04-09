class ClassificationCache {
  constructor(ttlMinutes = 60) {
    this.cache = new Map();
    this.ttl = ttlMinutes * 60 * 1000;
    this.hits = 0;
    this.misses = 0;
  }

  getKey(email) {
    return email.id || `${email.subject}-${email.sender}`;
  }

  set(email, classification) {
    const key = this.getKey(email);
    this.cache.set(key, {
      data: classification,
      timestamp: Date.now()
    });
  }

  get(email) {
    const key = this.getKey(email);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    this.hits++;
    console.log(`[Cache] HIT (${this.hits}/${this.hits + this.misses}) for: ${email.subject?.substring(0, 50)}`);
    return entry.data;
  }

  getStats() {
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / (this.hits + this.misses) || 0
    };
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    console.log('[Cache] Cleared');
  }
}

module.exports = { ClassificationCache };