import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
//
// Learn more: https://pris.ly/d/help/next-js-best-practices

// Prevent multiple instances of Prisma Client in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// PrismaClient initialization with edge runtime detection
function getPrismaClient() {
  // Check if we're in an environment where PrismaClient can be instantiated
  // This prevents errors during build time and edge runtime
  if (process.env.NODE_ENV === 'production') {
    // In production, create a new instance each time (will be cached by the runtime)
    return new PrismaClient();
  }
  
  // In development, use the global variable to avoid multiple instances
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      // log: ['query'], // Uncomment to log queries in development
    });
  }
  return global.prisma;
}

// Try-catch wrapper to handle initialization failures during build time
const prismaInstance = (() => {
  try {
    return getPrismaClient();
  } catch (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _error
  ) {
    // During build time or in environments where Prisma can't connect to a DB,
    // provide a mock that won't throw when imported but will be replaced at runtime
    console.warn('Prisma client could not be initialized. This is expected during build.');
    return new Proxy({} as PrismaClient, {
      get: (_target, prop) => {
        // Return a dummy function that will be replaced at runtime with the real client
        if (typeof prop === 'string' && !['then', 'catch'].includes(prop)) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          return (..._args: unknown[]) => {
            console.error(`Prisma client method ${String(prop)} called before initialization`);
            return Promise.reject(new Error('Prisma not initialized'));
          };
        }
        return undefined;
      }
    });
  }
})();

export default prismaInstance; 