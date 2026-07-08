jest.mock('@/db/queries/users', () => ({
  updateUser: jest.fn(),
}));
jest.mock('@/db/queries/userProfile', () => ({
  getUserProfile: jest.fn(),
  upsertUserProfile: jest.fn(),
}));

import { mirrorScheduleToUser, mirrorScheduleToProfile } from '../scheduleSync';
import { updateUser } from '@/db/queries/users';
import { getUserProfile, upsertUserProfile } from '@/db/queries/userProfile';
import { emptyUserProfile } from '@/ai/types';

const updateUserMock = updateUser as jest.MockedFunction<typeof updateUser>;
const getUserProfileMock = getUserProfile as jest.MockedFunction<typeof getUserProfile>;
const upsertUserProfileMock = upsertUserProfile as jest.MockedFunction<typeof upsertUserProfile>;

const USER_ID = 'user-1';

describe('mirrorScheduleToUser', () => {
  beforeEach(() => updateUserMock.mockReset());

  it('writes all four schedule fields when supplied', () => {
    const written = mirrorScheduleToUser(USER_ID, {
      wakeTime: '10:00',
      sleepTime: '23:00',
      workStartTime: '11:00',
      workEndTime: '18:00',
    });
    expect(written).toEqual(['wakeTime', 'sleepTime', 'workStartTime', 'workEndTime']);
    expect(updateUserMock).toHaveBeenCalledTimes(1);
    expect(updateUserMock).toHaveBeenCalledWith(USER_ID, {
      wakeTime: '10:00',
      sleepTime: '23:00',
      workStartTime: '11:00',
      workEndTime: '18:00',
    });
  });

  it('writes only the fields that are present (partial schedule update)', () => {
    const written = mirrorScheduleToUser(USER_ID, { wakeTime: '06:30' });
    expect(written).toEqual(['wakeTime']);
    expect(updateUserMock).toHaveBeenCalledWith(USER_ID, { wakeTime: '06:30' });
  });

  it('skips updateUser entirely when nothing meaningful is supplied', () => {
    const written = mirrorScheduleToUser(USER_ID, {});
    expect(written).toEqual([]);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('treats empty / null fields as "not provided" — does not overwrite with empty', () => {
    const written = mirrorScheduleToUser(USER_ID, {
      wakeTime: '',
      sleepTime: null,
      workStartTime: '09:00',
    });
    expect(written).toEqual(['workStartTime']);
    expect(updateUserMock).toHaveBeenCalledWith(USER_ID, { workStartTime: '09:00' });
  });
});

describe('mirrorScheduleToProfile', () => {
  beforeEach(() => {
    getUserProfileMock.mockReset();
    upsertUserProfileMock.mockReset();
  });

  it('no-ops when no profile exists', async () => {
    getUserProfileMock.mockResolvedValueOnce(null);
    const written = await mirrorScheduleToProfile(USER_ID, { wakeTime: '10:00' });
    expect(written).toEqual([]);
    expect(upsertUserProfileMock).not.toHaveBeenCalled();
  });

  it('merges schedule fields into the existing profile.schedule without dropping other slots', async () => {
    // Build a realistic existing profile by hand-tweaking the empty template.
    const existingProfile = {
      ...emptyUserProfile('chat'),
      schedule: {
        wakeTime: '07:00',
        sleepTime: '23:00',
        workStartTime: '09:00',
        workEndTime: '17:00',
        fixedBlocks: [], commuteMinutes: null, transitionMinutes: null,
      },
      habits: { current: ['workout'], aspirational: [] },
    };
    getUserProfileMock.mockResolvedValueOnce(existingProfile);
    const written = await mirrorScheduleToProfile(USER_ID, { wakeTime: '10:00', sleepTime: '22:30' });
    expect(written).toEqual(['wakeTime', 'sleepTime']);
    expect(upsertUserProfileMock).toHaveBeenCalledTimes(1);
    const [, persistedProfile] = upsertUserProfileMock.mock.calls[0]!;
    expect(persistedProfile.schedule.wakeTime).toBe('10:00');
    expect(persistedProfile.schedule.sleepTime).toBe('22:30');
    // Unchanged schedule fields preserved
    expect(persistedProfile.schedule.workStartTime).toBe('09:00');
    expect(persistedProfile.schedule.workEndTime).toBe('17:00');
    // Other slots untouched
    expect(persistedProfile.habits.current).toEqual(['workout']);
  });
});
