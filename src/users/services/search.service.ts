import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user.entity';

interface SearchResult {
  userId: number;
  relevanceScore: number;
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async searchUsers(
    searchTerm: string,
    limit: number = 100,
  ): Promise<SearchResult[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return [];
    }

    const term = searchTerm.trim();

    // Use simple ILIKE search with relevance scoring
    const query = this.userRepository
      .createQueryBuilder('user')
      .select('user.id', 'userId')
      .addSelect(
        `
        CASE
          WHEN user.name ILIKE :exactTerm THEN 100
          WHEN user.name ILIKE :startTerm THEN 80
          WHEN user.name ILIKE :term THEN 60
          WHEN user.email ILIKE :startTerm THEN 50
          WHEN user.email ILIKE :term THEN 30
          ELSE 0
        END
      `,
        'relevanceScore',
      )
      .where('user.is_deleted = false')
      .andWhere('(user.name ILIKE :term OR user.email ILIKE :term)')
      .setParameters({
        exactTerm: term,
        startTerm: `${term}%`,
        term: `%${term}%`,
      })
      .orderBy('relevanceScore', 'DESC')
      .addOrderBy('user.created_at', 'DESC')
      .take(limit);

    const results = await query.getRawMany();

    return results.map((row) => ({
      userId: parseInt(row.userId, 10),
      relevanceScore: parseInt(row.relevanceScore, 10),
    }));
  }

  async buildSearchText(user: User): Promise<string> {
    // Build a simple search text combining name and email
    // In a real PostgreSQL setup, this would use tsvector
    return `${user.name} ${user.email}`.toLowerCase();
  }

  async updateSearchTextForUser(userId: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      return;
    }

    const searchText = await this.buildSearchText(user);
    await this.userRepository.update(userId, {
      search_text: searchText as any,
    });
  }

  tokenizeSearchTerm(term: string): string[] {
    return term
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }
}
