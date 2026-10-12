---
title: "Synology VMM에서 Ubuntu 설치가 멈출 때 확인할 설정"
pubDate: 2026-09-10T09:30:45+09:00
description: "Synology Virtual Machine Manager에서 Ubuntu 설치가 멈추거나 진행되지 않을 때 ISO 이미지, VM 리소스, 부팅 미디어, 콘솔과 QEMU Guest Agent까지 순서대로 점검하는 방법을 정리합니다."
category: Synology
tags:
  - Synology
  - Virtual Machine Manager
  - Ubuntu
  - VMM
  - Virtual Machine
  - QEMU
lang: ko
updatedDate: "2026-10-12"
---

Synology NAS의 Virtual Machine Manager(VMM)를 이용하면 별도 물리 서버 없이 Ubuntu Server를 가상 머신으로 운영할 수 있습니다.

하지만 Ubuntu ISO를 연결하고 VM을 시작했는데 설치 화면에서 멈추거나, 설치가 끝난 뒤 다시 설치 화면으로 돌아오는 문제가 생길 수 있습니다.

이럴 때는 **ISO → VM 리소스 → 저장소 → 부팅 미디어 → 콘솔 → 게스트 도구** 순서로 확인하면 원인을 좁히기 쉽습니다.

## 1. Ubuntu ISO 확인

VMM에서 다음 메뉴를 확인합니다.

```text
Virtual Machine Manager
→ Image
→ ISO File
```

Ubuntu 공식 사이트에서 받은 ISO를 사용하는 것이 좋습니다.

```text
ubuntu-xx.xx-live-server-amd64.iso
```

다운로드 또는 NAS 업로드 과정에서 파일이 손상되었는지 확인하려면 SHA256을 비교할 수 있습니다.

macOS:

```bash
shasum -a 256 ubuntu-xx.xx-live-server-amd64.iso
```

Linux:

```bash
sha256sum ubuntu-xx.xx-live-server-amd64.iso
```

## 2. ISO가 VM에 실제로 연결되어 있는지 확인

ISO를 VMM에 등록했다고 자동으로 VM에 연결되는 것은 아닙니다.

```text
Virtual Machine
→ 대상 VM
→ Action
→ Edit
```

설치 ISO가 CD/DVD 장치로 연결되어 있는지 확인합니다.

## 3. CPU와 메모리를 너무 작게 잡지 않는다

문제 진단용으로는 너무 작은 VM 사양을 피하는 것이 좋습니다.

예:

```text
vCPU: 2
RAM : 2~4 GB
Disk: 20 GB 이상
```

이는 절대적인 최소 요구사항이 아니라 설치 중 리소스 부족 가능성을 먼저 배제하기 위한 예시입니다.

NAS에서 다른 VM을 여러 개 실행 중이라면 일부를 종료한 뒤 다시 테스트합니다.

## 4. 가상 디스크와 NAS 저장소 여유 공간 확인

다음 두 가지를 함께 확인합니다.

```text
VM 가상 디스크 크기
NAS Storage Pool / Volume 여유 공간
```

VM에 충분한 디스크를 할당했더라도 실제 NAS 볼륨이 거의 가득 찬 상태라면 안정적인 설치와 운영이 어렵습니다.

## 5. 설치 화면이 멈춘 것인지 콘솔만 멈춘 것인지 구분

VMM에서 VM을 선택하고 `Connect`로 다시 접속합니다.

화면이 정지해 보여도 VM 자체가 반드시 멈춘 것은 아닙니다.

다음을 확인합니다.

- 키보드 입력 반응 여부
- VM CPU 사용량 변화
- 콘솔 재접속 후 화면 변화
- 정상 종료 명령에 반응하는지

브라우저 콘솔 문제라면 다시 연결했을 때 정상 화면이 나타날 수 있습니다.

## 6. 설치가 끝났는데 다시 설치 화면이 나오는 경우

Ubuntu 설치 후 재부팅했는데 다시 설치 메뉴가 나온다면 ISO가 계속 부팅 미디어로 연결되어 있는지 확인합니다.

```text
설치 완료
→ VM 종료
→ Ubuntu ISO 분리
→ VM 시작
→ 가상 디스크에서 부팅
```

설치 자체가 실패한 것이 아닐 수 있습니다.

## 7. 같은 위치에서 반복적으로 멈춘다면

다음 순서로 하나씩 확인합니다.

```text
1. ISO 체크섬 확인
2. ISO 재업로드
3. RAM 증가
4. vCPU 2개 이상으로 테스트
5. 새 가상 디스크 생성
6. NAS 여유 공간 확인
7. 새 VM을 만들어 동일 ISO로 재현 확인
```

여러 설정을 동시에 바꾸면 실제 원인을 찾기 어려우므로 한 번에 하나씩 변경합니다.

## 8. Ubuntu 설치 후 네트워크 확인

IP 주소:

```bash
ip addr
```

라우팅:

```bash
ip route
```

외부 IP 통신:

```bash
ping -c 4 8.8.8.8
```

DNS:

```bash
ping -c 4 ubuntu.com
```

IP 통신은 되지만 도메인만 실패한다면 DNS 설정을 확인합니다.

## 9. apt 패키지 설치는 sudo 사용

일반 사용자로 다음 명령을 실행하면:

```bash
apt install vim
```

다음과 같은 오류가 발생할 수 있습니다.

```text
Could not open lock file /var/lib/dpkg/lock-frontend
Permission denied
Are you root?
```

관리자 권한으로 실행합니다.

```bash
sudo apt update
sudo apt install vim
```

네트워크 도구가 필요하면:

```bash
sudo apt install net-tools
```

다만 최신 Ubuntu에서는 `ifconfig`, `netstat` 대신 `ip`, `ss` 명령도 많이 사용합니다.

```bash
ip addr
ss -lntp
```

## 10. QEMU Guest Agent 설치

Synology 공식 문서는 Ubuntu VM에서 QEMU Guest Agent 설치를 안내합니다.

```bash
sudo apt update
sudo apt install qemu-guest-agent
```

상태 확인:

```bash
systemctl status qemu-guest-agent
```

필요하면 활성화합니다.

```bash
sudo systemctl enable --now qemu-guest-agent
```

설치 후에는 VMM의 종료·재시작 명령 전달과 게스트 정보 확인이 더 원활해질 수 있습니다.

## 11. 설치 후 기본 점검 명령

```bash
cat /etc/os-release
lscpu
free -h
lsblk
df -h
ip addr
ss -lntp
```

## 최종 점검 순서

```text
Ubuntu ISO 확인
↓
VM에 ISO 연결 확인
↓
CPU / RAM / Disk 확인
↓
NAS 저장공간 확인
↓
VMM 콘솔 재접속
↓
새 VM으로 재현 테스트
↓
설치 후 ISO 분리
↓
Ubuntu 네트워크 확인
↓
QEMU Guest Agent 설치
```

## 운영 중 겪은 디스크 공간 문제: VM 디스크와 파일시스템은 다르다

이 블로그에서 운영하는 Ubuntu 가상 서버는 설치 후 실제 운영 과정에서 **루트 파일시스템의 사용률이 100%에 도달한 적이 있다**. 당시 `df -h /`로 확인한 용량은 약 31GB였으며, 디스크 확장 작업 이후 약 124GB로 늘어났다.

이 사례는 **Ubuntu 설치 화면 정지의 원인이라고 확인된 사례가 아니다**. 설치 후에도 비슷하게 "VM에 용량을 늘렸는데 공간이 부족하다"는 문제를 만날 수 있어 구분해서 기록한다.

가상 머신에서는 최소 세 가지 크기를 별도로 봐야 한다.

| 구분 | 확인 위치 | 핵심 |
|---|---|---|
| NAS 물리 저장소 여유 공간 | DSM Storage Manager | VM 가상 디스크 파일을 저장할 공간 |
| VM에 할당된 가상 디스크 | VMM의 VM 설정 | 게스트가 인식할 수 있는 디스크 크기 |
| Ubuntu 파티션·파일시스템 | `lsblk`, `df -h /` | 실제 OS가 사용하는 공간 |

```bash
lsblk
df -h /
df -i /
```

VMM에서 가상 디스크를 확장해도 Ubuntu 내부 **파티션과 파일시스템이 자동으로 함께 확장되는 것은 아닐 수 있다**. 파티션 형식, LVM 사용 여부, 파일시스템 종류에 따라 필요한 절차가 다르므로 먼저 구성과 백업을 확인한다. 무작정 디스크 명령어를 실행하면 오히려 데이터를 잃을 수 있다.

## 설치 중 정지와 설치 후 장애를 구분하는 진단표

| 관찰한 상황 | 확인 순서 | 다음 판단 |
|---|---|---|
| ISO 부팅 화면도 보이지 않음 | 이미지 연결·부팅 순서·콘솔 | Ubuntu 패키지 문제가 아닐 수 있음 |
| 설치 중 진행률이 오래 멈춤 | VM 리소스·스토리지·콘솔 반응 | 한 항목씩 변경하여 재현 |
| 설치 후 ISO 메뉴로 다시 부팅 | ISO 연결 및 부팅 미디어 | 설치 실패보다 부팅 순서를 우선 점검 |
| 설치는 완료됐으나 SSH가 안 됨 | `ip addr`, `ip route`, `ss -lntp` | 네트워크·SSH 서비스 분리 확인 |
| 운영 중 저장/로그 오류 | `df -h /`, `df -i /`, `lsblk` | 게스트 파일시스템 부족 여부 확인 |

설치가 끝난 Ubuntu에서 부팅 중 오류를 조사할 때는 다음 명령을 사용할 수 있다.

```bash
journalctl -b -p err --no-pager | tail -n 40
```

단, 이 명령은 **부팅한 Ubuntu 게스트에서만** 실행할 수 있으며 VMM의 ISO 설치 화면 자체를 진단해 주지는 않는다. 출력되는 호스트명이나 네트워크 정보를 블로그에 공유할 때는 가린다.

## 정상 확인 기준과 후속 운영

설치 성공은 설치 화면이 끝나는 것만으로 판단하지 않는다. **ISO 없이 가상 디스크에서 재부팅**, Ubuntu 로그인, IP 및 DNS 통신, 파일시스템 여유 공간, 필요한 서비스 실행까지 확인하면 후속 장애를 줄일 수 있다.

VM에서 실제 서비스를 운영한다면 [GitHub Actions Self-hosted Runner 구성](/ko/posts/github-actions-self-hosted/)과 [SSH 터널로 원격 MySQL 연결](/ko/posts/ssh-mysql-tunnel/)도 함께 참고할 수 있다.

## 마무리

Synology VMM에서 Ubuntu 설치가 멈춘 것처럼 보인다면 Ubuntu 자체만 의심하기보다 **설치 이미지, VM 자원, 저장소, 부팅 미디어와 웹 콘솔**을 함께 확인해야 합니다.

설치 후에는 `qemu-guest-agent`까지 구성해 두면 VMM에서 장기적으로 VM을 관리하기 편합니다.

## 참고 자료

- Synology Knowledge Center - Virtual Machine Manager 이미지 관리  
  https://kb.synology.com/ko-kr/DSM/help/Virtualization/image
- Synology Knowledge Center - QEMU Guest Agent 설치  
  https://kb.synology.com/ko-kr/DSM/tutorial/How_to_install_Synology_Guest_Agent_for_VMM_on_your_virtual_machine
- Ubuntu Server  
  https://ubuntu.com/download/server
