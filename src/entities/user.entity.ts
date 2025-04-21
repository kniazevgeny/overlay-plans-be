import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Project } from './project.entity';
import { TimeSlot } from './time-slot.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false, unique: true })
  telegramId: number;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  username: string;

  @Column({ nullable: true, default: 'en' })
  language: string;

  @ManyToMany(() => Project)
  @JoinTable()
  projects: Project[];

  @OneToMany(() => TimeSlot, (timeSlot) => timeSlot.user)
  timeSlots: TimeSlot[];
}
