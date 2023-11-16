import { P, match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';
import { Prisma, TeamMemberInvite } from '@documenso/prisma/client';

import { FindResultSet } from '../../types/find-result-set';

export interface FindTeamMemberInvitesOptions {
  userId: number;
  teamId: number;
  term?: string;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof TeamMemberInvite;
    direction: 'asc' | 'desc';
  };
}

export const findTeamMemberInvites = async ({
  userId,
  teamId,
  term,
  page = 1,
  perPage = 10,
  orderBy,
}: FindTeamMemberInvitesOptions) => {
  const orderByColumn = orderBy?.column ?? 'email';
  const orderByDirection = orderBy?.direction ?? 'desc';

  // Check that the user belongs to the team they are trying to find invites in.
  const userTeam = await prisma.team.findUniqueOrThrow({
    where: {
      id: teamId,
      members: {
        some: {
          userId,
        },
      },
      // Todo: Teams - Should only certain roles be able to find members?
    },
  });

  const termFilters: Prisma.TeamMemberInviteWhereInput | undefined = match(term)
    .with(P.string.minLength(1), () => ({
      email: {
        contains: term,
        mode: Prisma.QueryMode.insensitive,
      },
    }))
    .otherwise(() => undefined);

  const whereClause: Prisma.TeamMemberInviteWhereInput = {
    ...termFilters,
    id: userTeam.id,
  };

  const [data, count] = await Promise.all([
    prisma.teamMemberInvite.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
      // Exclude token attribute.
      select: {
        id: true,
        teamId: true,
        email: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.teamMemberInvite.count({
      where: whereClause,
    }),
  ]);

  return {
    data,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
  } satisfies FindResultSet<typeof data>;
};
