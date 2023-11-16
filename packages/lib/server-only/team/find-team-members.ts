import { P, match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';
import { Prisma, TeamMember } from '@documenso/prisma/client';

import { FindResultSet } from '../../types/find-result-set';

export interface FindTeamMembersOptions {
  userId: number;
  teamId: number;
  term?: string;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof TeamMember | 'name';
    direction: 'asc' | 'desc';
  };
}

export const findTeamMembers = async ({
  userId,
  teamId,
  term,
  page = 1,
  perPage = 10,
  orderBy,
}: FindTeamMembersOptions) => {
  const orderByColumn = orderBy?.column ?? 'name';
  const orderByDirection = orderBy?.direction ?? 'desc';

  // Check that the user belongs to the team they are trying to find members in.
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

  const termFilters: Prisma.TeamMemberWhereInput | undefined = match(term)
    .with(P.string.minLength(1), () => ({
      user: {
        name: {
          contains: term,
          mode: Prisma.QueryMode.insensitive,
        },
      },
    }))
    .otherwise(() => undefined);

  const whereClause: Prisma.TeamMemberWhereInput = {
    ...termFilters,
    id: userTeam.id,
  };

  let orderByClause: Prisma.TeamMemberOrderByWithRelationInput = {
    [orderByColumn]: orderByDirection,
  };

  if (orderByColumn === 'name') {
    orderByClause = {
      user: {
        name: orderByDirection,
      },
    };
  }

  const [data, count] = await Promise.all([
    prisma.teamMember.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage,
      orderBy: orderByClause,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.teamMember.count({
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
