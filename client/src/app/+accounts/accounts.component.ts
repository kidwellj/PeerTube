import { Component, OnDestroy, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { AccountService } from '@app/shared/account/account.service'
import { Account } from '@app/shared/account/account.model'
import { RestExtractor, UserService } from '@app/shared'
import { catchError, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators'
import { Subscription } from 'rxjs'
import { AuthService, Notifier, RedirectService } from '@app/core'
import { User, UserRight } from '../../../../shared'
import { I18n } from '@ngx-translate/i18n-polyfill'
import { VideoChannelService } from '@app/shared/video-channel/video-channel.service'
import { VideoChannel } from '@app/shared/video-channel/video-channel.model'

@Component({
  templateUrl: './accounts.component.html',
  styleUrls: [ './accounts.component.scss' ]
})
export class AccountsComponent implements OnInit, OnDestroy {
  account: Account
  user: User
  videoChannels: VideoChannel[] = []

  private routeSub: Subscription

  constructor (
    private route: ActivatedRoute,
    private userService: UserService,
    private accountService: AccountService,
    private videoChannelService: VideoChannelService,
    private notifier: Notifier,
    private restExtractor: RestExtractor,
    private redirectService: RedirectService,
    private authService: AuthService,
    private i18n: I18n
  ) {}

  ngOnInit () {
    this.routeSub = this.route.params
      .pipe(
        map(params => params[ 'accountId' ]),
        distinctUntilChanged(),
        switchMap(accountId => this.accountService.getAccount(accountId)),
        tap(account => {
          this.account = account
          this.getUserIfNeeded(account)
        }),
        switchMap(account => this.videoChannelService.listAccountVideoChannels(account)),
        catchError(err => this.restExtractor.redirectTo404IfNotFound(err, [ 400, 404 ]))
      )
      .subscribe(
        videoChannels => this.videoChannels = videoChannels.data,

        err => this.notifier.error(err.message)
      )
  }

  ngOnDestroy () {
    if (this.routeSub) this.routeSub.unsubscribe()
  }

  get naiveAggregatedSubscribers () {
    return this.videoChannels.reduce(
      (acc, val) => acc + val.followersCount,
      this.account.followersCount // accumulator starts with the base number of subscribers the account has
    )
  }

  onUserChanged () {
    this.getUserIfNeeded(this.account)
  }

  onUserDeleted () {
    this.redirectService.redirectToHomepage()
  }

  activateCopiedMessage () {
    this.notifier.success(this.i18n('Username copied'))
  }

  subscribersDisplayFor (count: number) {
    return this.i18n(`{count, plural, =1 {1 subscriber} other {${count} subscribers}}`, { count })
  }

  private getUserIfNeeded (account: Account) {
    if (!account.userId) return
    if (!this.authService.isLoggedIn()) return

    const user = this.authService.getUser()
    if (user.hasRight(UserRight.MANAGE_USERS)) {
      this.userService.getUser(account.userId)
          .subscribe(
            user => this.user = user,

            err => this.notifier.error(err.message)
          )
    }
  }
}
