import { validate } from 'class-validator';
import { OnboardCreatorDto, HANDLE_REGEX } from './onboard-creator.dto';

function makeDto(handle: string): OnboardCreatorDto {
  const dto = new OnboardCreatorDto();
  dto.handle = handle;
  return dto;
}

describe('OnboardCreatorDto handle validation', () => {
  const validHandles = ['abc', 'jane_doe', 'user_123', 'a'.repeat(30), '___'];
  const invalidHandles = [
    'ab', // too short (2)
    'a'.repeat(31), // too long (31)
    'Jane', // uppercase
    'jane doe', // space
    'jane-doe', // hyphen
    'jane.doe', // dot
    'jane!', // special char
    '', // empty
  ];

  it.each(validHandles)('accepts valid handle "%s"', async (handle) => {
    const errors = await validate(makeDto(handle));
    expect(errors).toHaveLength(0);
    expect(HANDLE_REGEX.test(handle)).toBe(true);
  });

  it.each(invalidHandles)('rejects invalid handle "%s"', async (handle) => {
    const errors = await validate(makeDto(handle));
    expect(errors.some((e) => e.property === 'handle')).toBe(true);
    expect(HANDLE_REGEX.test(handle)).toBe(false);
  });

  it('passes with valid optional metadata', async () => {
    const dto = makeDto('jane_doe');
    dto.displayName = 'Jane Doe';
    dto.bio = 'Fitness coach';
    dto.bannerUrl = 'https://cdn.myfans.dev/banner.jpg';
    dto.category = 'fitness';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid bannerUrl', async () => {
    const dto = makeDto('jane_doe');
    dto.bannerUrl = 'not-a-url';

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'bannerUrl')).toBe(true);
  });

  it('rejects a bio longer than 300 characters', async () => {
    const dto = makeDto('jane_doe');
    dto.bio = 'a'.repeat(301);

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'bio')).toBe(true);
  });
});
