import { EventRepository } from './event.repository';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventDto } from './dto/event.dto';
import { CreateEventData } from './type/create-event-data.type';
import { JoinState } from '@prisma/client';
import { CreateEventPayload } from './payload/create-event.payload';
import { EventMyListDto } from './dto/event-my-dto';
import { EventDetailDto } from './dto/event-detail-dto';

@Injectable()
export class EventService {
  constructor(private readonly eventRepository: EventRepository) {}

  async createEvent(
    payload: CreateEventPayload,
    userId: number,
  ): Promise<EventDto> {
    const createData: CreateEventData = {
      hostId: userId,
      title: payload.title,
      dates: payload.dates,
      startTime: payload.startTime,
      endTime: payload.endTime,
    };

    if (createData.startTime < 0 || createData.startTime > 24) {
      throw new BadRequestException(
        'Event 시작 가능 시간은 0~24시 사이로 설정해야 합니다.',
      );
    }

    if (createData.endTime < 0 || createData.endTime > 24) {
      throw new BadRequestException(
        'Event 종료 가능 시간은 0~24시 사이로 설정해야 합니다.',
      );
    }

    const event = await this.eventRepository.createEvent(createData);

    return EventDto.from(event);
  }

  async inviteUser(
    eventId: number,
    userId: number,
    hostId: number,
  ): Promise<void> {
    const userPromise = this.eventRepository.getUserById(userId);
    const eventPromise = this.eventRepository.getEventById(eventId);
    const [user, event] = await Promise.all([userPromise, eventPromise]);

    if (!user) {
      throw new NotFoundException('존재하지 않는 user입니다.');
    }
    if (!event) {
      throw new NotFoundException('존재하지 않는 event입니다.');
    }

    if (event.hostId !== hostId) {
      throw new ForbiddenException('해당 이벤트의 host만 초대할 수 있습니다.');
    }

    const eventJoin = await this.eventRepository.getEventJoin(eventId, userId);
    if (eventJoin) {
      throw new ConflictException('이미 초대한 user입니다.');
    }

    await this.eventRepository.inviteUser(eventId, userId);
  }

  async joinEvent(eventId: number, userId: number): Promise<void> {
    const event = await this.eventRepository.getEventById(eventId);
    if (!event) {
      throw new NotFoundException('존재하지 않는 event입니다.');
    }

    const eventJoin = await this.eventRepository.getEventJoin(eventId, userId);
    if (eventJoin) {
      if (eventJoin.joinState === JoinState.JOINED) {
        throw new ConflictException('이미 참여 중인 이벤트입니다.');
      } else if (eventJoin.joinState === JoinState.REFUSED) {
        throw new ConflictException(
          '이미 참여 중인 이벤트입니다.(참여를 원할시, 이벤트초대 삭제 후 host에게 재초대 요청 필요)',
        );
      } else {
        await this.eventRepository.joinEvent(eventId, userId);
      }
    }
  }

  async refuseEvent(eventId: number, userId: number): Promise<void> {
    const event = await this.eventRepository.getEventById(eventId);
    if (!event) {
      throw new NotFoundException('존재하지 않는 event입니다.');
    }

    const eventJoin = await this.eventRepository.getEventJoin(eventId, userId);
    if (eventJoin) {
      if (eventJoin.joinState === JoinState.JOINED) {
        throw new ConflictException(
          '이미 참여 수락한 이벤트입니다. (이벤트 exit 가능)',
        );
      } else if (eventJoin.joinState === JoinState.REFUSED) {
        throw new ConflictException(
          '이미 참여 거절한 이벤트입니다. (이벤트 초대 삭제 가능)',
        );
      } else {
        await this.eventRepository.refuseEvent(eventId, userId);
      }
    }
  }

  async exitEvent(eventId: number, userId: number): Promise<void> {
    const event = await this.eventRepository.getEventById(eventId);
    if (!event) {
      throw new NotFoundException('존재하지 않는 event입니다.');
    }

    const eventJoin = await this.eventRepository.getEventJoin(eventId, userId);
    if (!eventJoin) {
      throw new NotFoundException('초대받지 않은 event입니다.');
    }

    await this.eventRepository.exitEvent(eventId, userId);
  }

  async deleteEvent(eventId: number, hostId: number): Promise<void> {
    const event = await this.eventRepository.getEventById(eventId);
    if (!event) {
      throw new NotFoundException('존재하지 않는 event입니다.');
    }

    if (event.hostId !== hostId) {
      throw new ForbiddenException('host만 이벤트를 삭제할 수 있습니다.');
    }

    await this.eventRepository.deleteEvent(eventId);
  }

  async getMyEvents(userId: number): Promise<EventMyListDto> {
    const events = await this.eventRepository.getMyEvents(userId);
    return EventMyListDto.from(events);
  }

  async getEventDetail(
    eventId: number,
    userId: number,
  ): Promise<EventDetailDto> {
    const eventJoin = await this.eventRepository.getEventJoin(eventId, userId);
    if (!eventJoin) {
      throw new ForbiddenException(
        '참여중인 user만 이벤트를 상세 조회할 수 있습니다.',
      );
    }

    const eventDetail = await this.eventRepository.getEventDetail(eventId);

    return EventDetailDto.from(eventDetail);
  }
}