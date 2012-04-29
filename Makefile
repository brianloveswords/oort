.PHONY: clean

all: clean test

clean:
	rm -rf oort-bare-repository

test:
	./bin/oort launch