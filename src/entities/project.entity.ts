import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToMany,
  OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { TimeSlot } from './time-slot.entity';

@Entity()
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: false })
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @ManyToMany(() => User, (user) => user.projects)
  users: User[];

  @OneToMany(() => TimeSlot, (timeSlot) => timeSlot.project)
  timeSlots: TimeSlot[];
}
