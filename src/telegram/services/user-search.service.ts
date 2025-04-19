// import { Injectable, Logger } from '@nestjs/common';
// import { Repository } from 'typeorm';
// import { InjectRepository } from '@nestjs/typeorm';
// import { User } from '../../entities/user.entity';
// import { Project } from '../../entities/project.entity';
// import { OpenAIService } from '../../openai.service';

// @Injectable()
// export class UserSearchService {
//   private readonly logger = new Logger(UserSearchService.name);

//   constructor(
//     @InjectRepository(User)
//     private readonly userRepository: Repository<User>,
//     @InjectRepository(Project)
//     private readonly projectRepository: Repository<Project>,
//     private readonly openAIService: OpenAIService,
//   ) {}

//   /**
//    * Perform direct text search on user properties
//    */
//   private searchUsersByText(users: User[], searchQuery: string): User[] {
//     if (!searchQuery || searchQuery.trim() === '') {
//       return [];
//     }

//     const normalizedQuery = searchQuery.toLowerCase().trim();

//     return users.filter((user) => {
//       // Check if any user property matches the search query
//       const firstName = (user.firstName || '').toLowerCase();
//       const lastName = (user.lastName || '').toLowerCase();
//       const username = (user.username || '').toLowerCase();

//       return (
//         firstName.includes(normalizedQuery) ||
//         lastName.includes(normalizedQuery) ||
//         username.includes(normalizedQuery) ||
//         `${firstName} ${lastName}`.includes(normalizedQuery)
//       );
//     });
//   }

//   /**
//    * Use AI to find users based on natural language understanding
//    */
//   private async findUsersWithAI(
//     users: User[],
//     searchQuery: string,
//     minConfidence: number,
//   ): Promise<{ user: User; confidence: number; reasoning?: string }[]> {
//     if (!searchQuery || searchQuery.trim() === '' || users.length === 0) {
//       return [];
//     }

//     try {
//       // Prepare user data for the AI
//       const projectUsers = users.map((user) => ({
//         id: user.id,
//         firstName: user.firstName,
//         lastName: user.lastName,
//         username: user.username,
//       }));

//       // Use OpenAI to extract user references
//       const userReferences = await this.openAIService.extractUserReferences(
//         searchQuery,
//         projectUsers,
//       );

//       // Match the AI results back to actual user objects
//       const aiMatches = userReferences
//         .filter((ref) => ref.confidence >= minConfidence)
//         .map((ref) => {
//           const matchedUser = users.find((user) => user.id === ref.userId);
//           if (matchedUser) {
//             return {
//               user: matchedUser,
//               confidence: ref.confidence,
//             };
//           }
//           return null;
//         })
//         .filter((match) => match !== null);

//       return aiMatches as {
//         user: User;
//         confidence: number;
//       }[];
//     } catch (error) {
//       this.logger.error(
//         `Error finding users with AI: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
//       );
//       return [];
//     }
//   }
// }
