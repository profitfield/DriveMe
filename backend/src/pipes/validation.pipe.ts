import { 
    PipeTransform, 
    Injectable, 
    ArgumentMetadata, 
    BadRequestException,
    ValidationError
  } from '@nestjs/common';
  import { validate } from 'class-validator';
  import { plainToClass } from 'class-transformer';
  
  @Injectable()
  export class ValidationPipe implements PipeTransform<any> {
    async transform(value: any, { metatype }: ArgumentMetadata) {
      if (!metatype || !this.toValidate(metatype)) {
        return value;
      }
  
      const object = plainToClass(metatype, value);
      const errors = await validate(object, {
        whitelist: true,
        forbidNonWhitelisted: true,
        forbidUnknownValues: true,
        validationError: {
          target: false
        }
      });
  
      if (errors.length > 0) {
        throw new BadRequestException(this.formatErrors(errors));
      }
  
      return value;
    }
  
    private toValidate(metatype: Function): boolean {
      const types: Function[] = [String, Boolean, Number, Array, Object];
      return !types.includes(metatype);
    }
  
    private formatErrors(errors: ValidationError[]) {
      return errors.map(error => ({
        field: error.property,
        errors: this.getErrorMessages(error),
        value: error.value
      }));
    }
  
    private getErrorMessages(error: ValidationError): string[] {
      const messages = [];
      if (error.constraints) {
        for (const constraint in error.constraints) {
          messages.push(error.constraints[constraint]);
        }
      }
      if (error.children && error.children.length > 0) {
        error.children.forEach(childError => {
          messages.push(...this.getErrorMessages(childError));
        });
      }
      return messages;
    }
  }