define(["require", "exports"], function (require, exports) {
    var Baz = (function () {
        function Baz() {
            this.hasRun = false;
        }
        Baz.prototype.run = function () {
            throw new Error('foo');
        };
        return Baz;
    })();
    return Baz;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmF6LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYmF6LnRzIl0sIm5hbWVzIjpbIkJheiIsIkJhei5jb25zdHJ1Y3RvciIsIkJhei5ydW4iXSwibWFwcGluZ3MiOiI7SUFBQTtRQUFBQTtZQUNDQyxXQUFNQSxHQUFXQSxLQUFLQSxDQUFDQTtRQUt4QkEsQ0FBQ0E7UUFIQUQsaUJBQUdBLEdBQUhBO1lBQ0NFLE1BQU1BLElBQUlBLEtBQUtBLENBQUNBLEtBQUtBLENBQUNBLENBQUNBO1FBQ3hCQSxDQUFDQTtRQUNGRixVQUFDQTtJQUFEQSxDQUFDQSxBQU5ELElBTUM7SUFFRCxPQUFTLEdBQUcsQ0FBQyJ9