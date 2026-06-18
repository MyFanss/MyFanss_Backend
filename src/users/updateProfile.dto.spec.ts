import { validate } from 'class-validator';
import { UpdateProfileDto } from './dtos/updateProfile.dto';

describe('UpdateProfileDto validation', () => {
  it('should pass with all valid optional fields', async () => {
    const dto = new UpdateProfileDto();
    dto.displayName = 'Jane Doe';
    dto.bio = 'Short bio';
    dto.avatarUrl = 'https://example.com/avatar.png';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should pass with no fields (all optional)', async () => {
    const dto = new UpdateProfileDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail when bio exceeds 300 characters', async () => {
    const dto = new UpdateProfileDto();
    dto.bio = 'a'.repeat(301);

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'bio')).toBe(true);
  });

  it('should pass when bio is exactly 300 characters', async () => {
    const dto = new UpdateProfileDto();
    dto.bio = 'a'.repeat(300);

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail when avatarUrl is not a valid URL', async () => {
    const dto = new UpdateProfileDto();
    dto.avatarUrl = 'not-a-url';

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'avatarUrl')).toBe(true);
  });

  it('should fail when displayName is not a string', async () => {
    const dto = Object.assign(new UpdateProfileDto(), { displayName: 123 });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'displayName')).toBe(true);
  });
});
