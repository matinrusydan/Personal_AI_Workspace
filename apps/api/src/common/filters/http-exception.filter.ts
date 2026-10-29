import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';
import { randomUUID } from 'crypto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: Record<string, unknown> = {};

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
      code = HttpStatus[status] || 'ERROR';
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const respObj = exceptionResponse as Record<string, unknown>;
      message = (respObj['message'] as string) || message;
      code = (respObj['error'] as string) || HttpStatus[status] || 'ERROR';
      details = respObj;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const traceId = (request.headers['x-trace-id'] as string) || randomUUID();

    response.status(status).json({
      error: {
        code,
        message,
        details,
        traceId,
      },
    });
  }
}
