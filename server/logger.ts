enum LogLevel {
    ERROR,
    WARN,
    INFO,
    DEBUG
}
  
export class Logger {
    private currentLogLevel: LogLevel;

    constructor(logLevel: string) {
        this.currentLogLevel = LogLevel[logLevel as keyof typeof LogLevel];
    }

    private log(level: LogLevel, message: string) {
        if (level <= this.currentLogLevel) {
        console.log(message);
        }
    }

    error(message: string) {
        this.log(LogLevel.ERROR, message);
    }

    warn(message: string) {
        this.log(LogLevel.WARN, message);
    }

    info(message: string) {
        this.log(LogLevel.INFO, message);
    }

    debug(message: string) {
        this.log(LogLevel.DEBUG, message);
    }
}
  
//   // Usage
//   const logger = new Logger(process.env.LOG_LEVEL || 'INFO');
//   logger.error('This is an error message');
//   logger.warn('This is a warning message');
//   logger.info('This is an info message');
//   logger.debug('This is a debug message');
  