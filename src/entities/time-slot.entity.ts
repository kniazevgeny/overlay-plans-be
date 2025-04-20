import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { User } from './user.entity';
import { Project } from './project.entity';
import { getColorForId } from '../constants/colors';

@Entity()
export class TimeSlot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'datetime' })
  startTime: Date;

  @Column({ type: 'datetime' })
  endTime: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string;

  @ManyToOne(() => User, (user) => user.timeSlots)
  user: User;

  @ManyToOne(() => Project, (project) => project.timeSlots)
  project: Project;

  @ManyToOne(() => User, { nullable: true })
  createdBy: User;

  @Column({ type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ type: 'varchar', default: 'available' })
  status: 'available' | 'busy';

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  updatedAt: Date;

  /**
   * Before inserting or updating a time slot, if color is not set,
   * assign a default color based on the user ID
   */
  @BeforeInsert()
  @BeforeUpdate()
  setDefaultColor() {
    if (!this.color && this.user && this.user.id) {
      this.color = getColorForId(this.user.id);
    }
  }
}
