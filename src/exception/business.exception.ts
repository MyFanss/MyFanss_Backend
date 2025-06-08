import { HttpException, HttpStatus } from "@nestjs/common";


export class BusinessLogicException extends HttpException {
    constructor(message: string, error: string = 'BusinessLogicError') {
    super({ message, error }, HttpStatus.BAD_REQUEST);
  }
}