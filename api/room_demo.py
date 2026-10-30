"""Test the room loop without the web app: python -m api.room_demo CAH07-01-01 CAH25-02-02"""
import json
import sys

from api.room import grow_room


def main():
    codes = sys.argv[1:]
    if not codes:
        sys.exit("usage: python -m api.room_demo <subject_code> [more codes]")
    print(json.dumps(grow_room(None, codes), indent=1))


if __name__ == "__main__":
    main()
